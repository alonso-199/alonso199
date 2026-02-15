import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Package, DollarSign, Hash, FileText, Check, Tags, ChevronDown, X, Trash2, RefreshCw, Calendar, Mic, MicOff, Wand2, Play, Square, Clock, Volume2 } from 'lucide-react-native';
import { fetchBNAExchangeRate } from '@/utils/exchangeRate';
import { parseDateParts, datePartsToISO } from '@/utils/dateUtils';
import Colors from '@/constants/colors';
import { useTransactions } from '@/context/TransactionContext';
import { TransactionType } from '@/types/transaction';
import { parseVoiceText, ParsedVoiceData } from '@/utils/voiceParser';
import { PendingRecording, loadPendingRecordings, savePendingRecording, deletePendingRecording } from '@/utils/pendingRecordings';
import { Audio } from 'expo-av';

interface SuggestionDropdownProps {
  suggestions: string[];
  onSelect: (value: string) => void;
  onDelete: (value: string) => void;
  visible: boolean;
  onClose: () => void;
}

function SuggestionDropdown({ suggestions, onSelect, onDelete, visible, onClose }: SuggestionDropdownProps) {
  if (!visible || suggestions.length === 0) return null;

  return (
    <View style={styles.suggestionDropdown}>
      <View style={styles.suggestionHeader}>
        <Text style={styles.suggestionTitle}>Valores recientes</Text>
        <TouchableOpacity onPress={onClose}>
          <X size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.suggestionList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {suggestions.map((item, index) => (
          <View key={index} style={styles.suggestionItem}>
            <TouchableOpacity
              style={styles.suggestionTextContainer}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <Text style={styles.suggestionText}>{item}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.suggestionDeleteButton}
              onPress={() => onDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={16} color={Colors.entrada} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type SpeechRecognitionStatus = 'idle' | 'listening' | 'processing' | 'done' | 'error' | 'unsupported';

function useSpeechRecognition() {
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const isSupported = useMemo(() => {
    if (Platform.OS === 'web') {
      const win = typeof window !== 'undefined' ? window : null;
      return !!(win && ((win as any).SpeechRecognition || (win as any).webkitSpeechRecognition));
    }
    return false;
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }

    try {
      const win = window as any;
      const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();

      recognition.lang = 'es-AR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('[SpeechRecognition] Started listening');
        setStatus('listening');
        setTranscript('');
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let finalText = '';
        let interimText = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        if (finalText) setTranscript(finalText);
        setInterimTranscript(interimText);
      };

      recognition.onerror = (event: any) => {
        console.error('[SpeechRecognition] Error:', event.error);
        if (event.error !== 'aborted') {
          setStatus('error');
        }
      };

      recognition.onend = () => {
        console.log('[SpeechRecognition] Ended');
        if (status === 'listening') {
          setStatus('done');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('[SpeechRecognition] Failed to start:', error);
      setStatus('error');
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setStatus('processing');
      setTimeout(() => setStatus('done'), 300);
    }
  }, []);

  const reset = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_e) {}
      recognitionRef.current = null;
    }
    setStatus('idle');
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    status,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    reset,
  };
}

type NativeRecordingStatus = 'idle' | 'recording' | 'stopped' | 'saving' | 'error';

function useNativeAudioRecorder() {
  const [recordingStatus, setRecordingStatus] = useState<NativeRecordingStatus>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      console.log('[NativeRecorder] Requesting permissions');
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso al micrófono para grabar audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('[NativeRecorder] Starting recording');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecordingStatus('recording');
      setRecordingDuration(0);
      setRecordingUri(null);

      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[NativeRecorder] Failed to start:', error);
      setRecordingStatus('error');
      Alert.alert('Error', 'No se pudo iniciar la grabación. Verificá los permisos del micrófono.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return null;
    try {
      console.log('[NativeRecorder] Stopping recording');
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      console.log('[NativeRecorder] Recording saved at:', uri);
      recordingRef.current = null;
      setRecordingStatus('stopped');
      if (uri) setRecordingUri(uri);
      return uri;
    } catch (error) {
      console.error('[NativeRecorder] Failed to stop:', error);
      setRecordingStatus('error');
      return null;
    }
  }, []);

  const resetRecorder = useCallback(() => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (recordingRef.current) {
      try {
        recordingRef.current.stopAndUnloadAsync();
      } catch (_e) {}
      recordingRef.current = null;
    }
    setRecordingStatus('idle');
    setRecordingDuration(0);
    setRecordingUri(null);
  }, []);

  useEffect(() => {
    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (recordingRef.current) {
        try { recordingRef.current.stopAndUnloadAsync(); } catch (_e) {}
      }
    };
  }, []);

  return {
    recordingStatus,
    recordingDuration,
    recordingUri,
    startRecording,
    stopRecording,
    resetRecorder,
  };
}

interface VoiceInputModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (data: ParsedVoiceData, rawText: string) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function VoiceInputModal({ visible, onClose, onApply }: VoiceInputModalProps) {
  const {
    status,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    reset,
  } = useSpeechRecognition();

  const isNative = Platform.OS !== 'web';
  const {
    recordingStatus,
    recordingDuration,
    recordingUri,
    startRecording,
    stopRecording,
    resetRecorder,
  } = useNativeAudioRecorder();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [parsedData, setParsedData] = useState<ParsedVoiceData | null>(null);
  const [manualText, setManualText] = useState('');
  const [savingRecording, setSavingRecording] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [playingBack, setPlayingBack] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const isAnimating = isNative ? recordingStatus === 'recording' : status === 'listening';
    if (isAnimating) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, recordingStatus, isNative]);

  useEffect(() => {
    const fullText = transcript || interimTranscript;
    if (fullText) {
      setParsedData(parseVoiceText(fullText));
    }
  }, [transcript, interimTranscript]);

  const handleClose = useCallback(() => {
    reset();
    resetRecorder();
    setParsedData(null);
    setManualText('');
    setSavedSuccess(false);
    if (soundRef.current) {
      soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    onClose();
  }, [reset, resetRecorder, onClose]);

  const handleApply = () => {
    const textToUse = manualText.trim() || transcript || interimTranscript;
    if (!textToUse) {
      Alert.alert('Sin datos', 'No se detectó ningún texto. Intentá de nuevo.');
      return;
    }
    const data = parseVoiceText(textToUse);
    onApply(data, textToUse);
    handleClose();
  };

  const handleManualParse = () => {
    if (manualText.trim()) {
      setParsedData(parseVoiceText(manualText.trim()));
    }
  };

  const handleSaveRecording = async () => {
    if (!recordingUri) return;
    setSavingRecording(true);
    try {
      const recording: PendingRecording = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        uri: recordingUri,
        createdAt: new Date().toISOString(),
        description: manualText.trim() || undefined,
      };
      await savePendingRecording(recording);
      console.log('[VoiceModal] Recording saved for later:', recording.id);
      setSavedSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (error) {
      console.error('[VoiceModal] Error saving recording:', error);
      Alert.alert('Error', 'No se pudo guardar la grabación.');
    } finally {
      setSavingRecording(false);
    }
  };

  const handlePlaybackRecording = async () => {
    if (!recordingUri) return;
    try {
      if (playingBack && soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlayingBack(false);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: recordingUri });
      soundRef.current = sound;
      setPlayingBack(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          setPlayingBack(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch (error) {
      console.error('[VoiceModal] Playback error:', error);
      setPlayingBack(false);
    }
  };

  const currentText = transcript || interimTranscript || '';

  const renderNativeRecording = () => (
    <>
      <View style={styles.voiceArea}>
        {recordingStatus === 'idle' && (
          <View style={styles.nativeRecordHintContainer}>
            <Mic size={36} color={Colors.textLight} />
            <Text style={styles.voiceHint}>
              Tocá el micrófono para grabar un audio.{'\n'}
              Si no tenés internet, el audio se guardará y podrás cargarlo después.
            </Text>
          </View>
        )}

        {recordingStatus === 'recording' && (
          <View style={styles.listeningContainer}>
            <View style={styles.listeningWaves}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.listeningWaveBar,
                    {
                      height: 12 + Math.random() * 20,
                      transform: [{ scaleY: pulseAnim }],
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.recordingTimerRow}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimerText}>{formatDuration(recordingDuration)}</Text>
            </View>
            <Text style={styles.listeningText}>Grabando...</Text>
          </View>
        )}

        {recordingStatus === 'stopped' && recordingUri && (
          <View style={styles.recordingDoneContainer}>
            <Check size={28} color={Colors.success} />
            <Text style={styles.recordingDoneTitle}>Audio grabado</Text>
            <Text style={styles.recordingDoneSubtitle}>Duración: {formatDuration(recordingDuration)}</Text>
            <TouchableOpacity
              style={styles.playbackButton}
              onPress={handlePlaybackRecording}
              activeOpacity={0.7}
            >
              {playingBack ? (
                <Square size={16} color={Colors.primary} />
              ) : (
                <Play size={16} color={Colors.primary} />
              )}
              <Text style={styles.playbackButtonText}>
                {playingBack ? 'Detener' : 'Reproducir'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {recordingStatus === 'error' && (
          <Text style={styles.errorText}>
            Error al grabar. Verificá los permisos del micrófono e intentá de nuevo.
          </Text>
        )}

        {savedSuccess && (
          <View style={styles.savedSuccessContainer}>
            <Check size={32} color={Colors.success} />
            <Text style={styles.savedSuccessText}>Audio guardado para después</Text>
          </View>
        )}
      </View>

      {!savedSuccess && (
        <View style={styles.micButtonRow}>
          {recordingStatus === 'recording' ? (
            <TouchableOpacity
              style={[styles.micButton, styles.micButtonActive]}
              onPress={stopRecording}
              testID="voice-stop-button"
            >
              <Square size={24} color="#FFF" />
              <Text style={styles.micButtonText}>Detener</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.micButton}
              onPress={() => {
                resetRecorder();
                setSavedSuccess(false);
                startRecording();
              }}
              testID="voice-start-button"
            >
              <Mic size={28} color="#FFF" />
              <Text style={styles.micButtonText}>
                {recordingStatus === 'stopped' || recordingStatus === 'error' ? 'Regrabar' : 'Grabar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );

  const renderWebRecording = () => (
    <>
      <View style={styles.voiceArea}>
        {status === 'idle' && (
          <Text style={styles.voiceHint}>
            Tocá el micrófono y dictá los datos de la transacción.{'\n'}
            Ejemplo: "Compra de 10 kilos de arroz a 500 pesos"
          </Text>
        )}

        {status === 'listening' && (
          <View style={styles.listeningContainer}>
            <View style={styles.listeningWaves}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.listeningWaveBar,
                    {
                      height: 12 + Math.random() * 20,
                      transform: [{ scaleY: pulseAnim }],
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.listeningText}>Escuchando...</Text>
          </View>
        )}

        {status === 'processing' && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.processingText}>Procesando audio...</Text>
          </View>
        )}

        {status === 'error' && (
          <Text style={styles.errorText}>
            Error al capturar el audio. Verificá los permisos del micrófono e intentá de nuevo.
          </Text>
        )}

        {currentText ? (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptLabel}>Texto detectado:</Text>
            <Text style={styles.transcriptText}>"{currentText}"</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.micButtonRow}>
        {status === 'listening' ? (
          <TouchableOpacity
            style={[styles.micButton, styles.micButtonActive]}
            onPress={stopListening}
            testID="voice-stop-button"
          >
            <MicOff size={28} color="#FFF" />
            <Text style={styles.micButtonText}>Detener</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.micButton}
            onPress={startListening}
            testID="voice-start-button"
          >
            <Mic size={28} color="#FFF" />
            <Text style={styles.micButtonText}>
              {status === 'done' || status === 'error' ? 'Reintentar' : 'Grabar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.modalOverlay}>
        <ScrollView
          style={{ maxHeight: '90%' }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Entrada por voz</Text>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseButton}>
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {isNative ? renderNativeRecording() : (
              isSupported ? renderWebRecording() : (
                <View style={styles.nativeHintContainer}>
                  <MicOff size={40} color={Colors.textLight} />
                  <Text style={styles.nativeHintTitle}>No disponible en este navegador</Text>
                  <Text style={styles.nativeHintText}>
                    El reconocimiento de voz no es compatible con este navegador.
                    {'\n\n'}
                    Podés escribir el texto manualmente abajo.
                  </Text>
                </View>
              )
            )}

            <View style={styles.manualInputSection}>
              <Text style={styles.manualInputLabel}>
                {isNative
                  ? 'Escribí los datos de la transacción:'
                  : (isSupported ? 'O escribí manualmente:' : 'Escribí los datos de la transacción:')}
              </Text>
              <TextInput
                style={styles.manualInput}
                placeholder='Ej: "Compra 10 kilos de arroz a 500 pesos"'
                placeholderTextColor={Colors.textLight}
                value={manualText}
                onChangeText={setManualText}
                multiline
                numberOfLines={2}
                onBlur={handleManualParse}
              />
            </View>

            {(parsedData && (currentText || manualText.trim())) ? (
              <View style={styles.parsedPreview}>
                <View style={styles.parsedPreviewHeader}>
                  <Wand2 size={16} color={Colors.primary} />
                  <Text style={styles.parsedPreviewTitle}>Datos detectados</Text>
                </View>
                <View style={styles.parsedFields}>
                  {parsedData.type && (
                    <View style={styles.parsedField}>
                      <Text style={styles.parsedFieldLabel}>Tipo:</Text>
                      <View style={[
                        styles.parsedFieldBadge,
                        { backgroundColor: parsedData.type === 'entrada' ? Colors.entrada + '20' : Colors.salida + '20' }
                      ]}>
                        <Text style={[
                          styles.parsedFieldBadgeText,
                          { color: parsedData.type === 'entrada' ? Colors.entrada : Colors.salida }
                        ]}>
                          {parsedData.type === 'entrada' ? 'Compra' : 'Venta'}
                        </Text>
                      </View>
                    </View>
                  )}
                  {parsedData.productName && (
                    <View style={styles.parsedField}>
                      <Text style={styles.parsedFieldLabel}>Producto:</Text>
                      <Text style={styles.parsedFieldValue}>{parsedData.productName}</Text>
                    </View>
                  )}
                  {parsedData.quantity && (
                    <View style={styles.parsedField}>
                      <Text style={styles.parsedFieldLabel}>Cantidad:</Text>
                      <Text style={styles.parsedFieldValue}>{parsedData.quantity}</Text>
                    </View>
                  )}
                  {parsedData.unitPrice && (
                    <View style={styles.parsedField}>
                      <Text style={styles.parsedFieldLabel}>Precio:</Text>
                      <Text style={styles.parsedFieldValue}>${parsedData.unitPrice}</Text>
                    </View>
                  )}
                  {!parsedData.type && !parsedData.productName && !parsedData.quantity && !parsedData.unitPrice && (
                    <Text style={styles.parsedFieldEmpty}>No se pudieron detectar datos. Probá con frases como "compra 10 kilos de arroz a 500 pesos".</Text>
                  )}
                </View>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              {isNative && recordingStatus === 'stopped' && recordingUri && !savedSuccess && (
                <TouchableOpacity
                  style={styles.saveRecordingButton}
                  onPress={handleSaveRecording}
                  disabled={savingRecording}
                >
                  {savingRecording ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Clock size={18} color={Colors.accent} />
                  )}
                  <Text style={styles.saveRecordingText}>Guardar para después</Text>
                </TouchableOpacity>
              )}
              {!savedSuccess && (
                <>
                  <TouchableOpacity style={styles.modalCancelButton} onPress={handleClose}>
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalApplyButton,
                      !(currentText || manualText.trim()) && styles.modalApplyButtonDisabled,
                    ]}
                    onPress={handleApply}
                    disabled={!(currentText || manualText.trim())}
                  >
                    <Check size={18} color="#FFF" />
                    <Text style={styles.modalApplyText}>Aplicar datos</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface PendingRecordingsListProps {
  onApply: (data: ParsedVoiceData, rawText: string) => void;
}

function PendingRecordingsList({ onApply }: PendingRecordingsListProps) {
  const [recordings, setRecordings] = useState<PendingRecording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [manualTexts, setManualTexts] = useState<Record<string, string>>({});
  const soundRef = useRef<Audio.Sound | null>(null);

  const loadRecordings = useCallback(async () => {
    const loaded = await loadPendingRecordings();
    setRecordings(loaded);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      loadRecordings();
    }
  }, [loadRecordings]);

  const handlePlay = async (recording: PendingRecording) => {
    try {
      if (playingId === recording.id && soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlayingId(null);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: recording.uri });
      soundRef.current = sound;
      setPlayingId(recording.id);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch (error) {
      console.error('[PendingRecordings] Playback error:', error);
      setPlayingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Eliminar grabación',
      '¿Estás seguro de que querés eliminar esta grabación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deletePendingRecording(id);
            loadRecordings();
          },
        },
      ]
    );
  };

  const handleApplyText = (id: string) => {
    const text = manualTexts[id]?.trim();
    if (!text) {
      Alert.alert('Sin datos', 'Escribí los datos de la transacción después de escuchar el audio.');
      return;
    }
    const data = parseVoiceText(text);
    onApply(data, text);
    deletePendingRecording(id).then(() => loadRecordings());
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  if (Platform.OS === 'web' || recordings.length === 0) return null;

  return (
    <View style={styles.pendingSection}>
      <View style={styles.pendingSectionHeader}>
        <Clock size={18} color={Colors.accent} />
        <Text style={styles.pendingSectionTitle}>Audios pendientes ({recordings.length})</Text>
      </View>
      <Text style={styles.pendingSectionSubtitle}>
        Reproducí el audio y escribí los datos para cargar la transacción
      </Text>
      {recordings.map((rec) => {
        const isExpanded = expandedId === rec.id;
        const createdDate = new Date(rec.createdAt);
        const dateStr = createdDate.toLocaleDateString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        return (
          <View key={rec.id} style={styles.pendingCard}>
            <TouchableOpacity
              style={styles.pendingCardHeader}
              onPress={() => setExpandedId(isExpanded ? null : rec.id)}
              activeOpacity={0.7}
            >
              <View style={styles.pendingCardInfo}>
                <Volume2 size={18} color={Colors.primary} />
                <View style={styles.pendingCardTextCol}>
                  <Text style={styles.pendingCardDate}>{dateStr}</Text>
                  {rec.description ? (
                    <Text style={styles.pendingCardDesc} numberOfLines={1}>{rec.description}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.pendingCardActions}>
                <TouchableOpacity
                  style={styles.pendingPlayButton}
                  onPress={() => handlePlay(rec)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {playingId === rec.id ? (
                    <Square size={16} color={Colors.primary} />
                  ) : (
                    <Play size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(rec.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color={Colors.entrada} />
                </TouchableOpacity>
                <ChevronDown
                  size={16}
                  color={Colors.textSecondary}
                  style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                />
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.pendingCardExpanded}>
                <Text style={styles.pendingExpandedLabel}>
                  Escuchá el audio y escribí los datos:
                </Text>
                <TextInput
                  style={styles.pendingTextInput}
                  placeholder='Ej: "Compra 10 kilos de arroz a 500"'
                  placeholderTextColor={Colors.textLight}
                  value={manualTexts[rec.id] || ''}
                  onChangeText={(text) => setManualTexts(prev => ({ ...prev, [rec.id]: text }))}
                  multiline
                  numberOfLines={2}
                />
                <TouchableOpacity
                  style={[
                    styles.pendingApplyButton,
                    !manualTexts[rec.id]?.trim() && { opacity: 0.4 },
                  ]}
                  onPress={() => handleApplyText(rec.id)}
                  disabled={!manualTexts[rec.id]?.trim()}
                >
                  <Check size={16} color="#FFF" />
                  <Text style={styles.pendingApplyText}>Cargar transacción</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function AddTransactionScreen() {
  const { addTransaction, suggestions, deleteSuggestion } = useTransactions();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [type, setType] = useState<TransactionType>('entrada');
  const [productType, setProductType] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [showProductTypeSuggestions, setShowProductTypeSuggestions] = useState(false);
  const [showProductNameSuggestions, setShowProductNameSuggestions] = useState(false);
  const [showNotesSuggestions, setShowNotesSuggestions] = useState(false);
  
  const [currencyMode, setCurrencyMode] = useState<'ARS' | 'USD'>('ARS');
  const [ivaOption, setIvaOption] = useState<'final' | 'iva21' | 'iva105'>('final');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [transactionDate, setTransactionDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const dateParts = parseDateParts(transactionDate);
  const [dayInput, setDayInput] = useState(dateParts.day);
  const [monthInput, setMonthInput] = useState(dateParts.month);
  const [yearInput, setYearInput] = useState(dateParts.year);

  useEffect(() => {
    const { day, month, year } = parseDateParts(transactionDate);
    setDayInput(day);
    setMonthInput(month);
    setYearInput(year);
  }, [transactionDate]);

  useEffect(() => {
    loadExchangeRate();
  }, []);

  const loadExchangeRate = async () => {
    setLoadingRate(true);
    try {
      const rate = await fetchBNAExchangeRate();
      setExchangeRate(rate);
      console.log('[AddTransaction] Exchange rate loaded:', rate);
    } catch (error) {
      console.error('[AddTransaction] Error loading exchange rate:', error);
    } finally {
      setLoadingRate(false);
    }
  };

  const formatNumberWithSeparators = (value: string): string => {
    const cleanValue = value.replace(/[^0-9,]/g, '');
    
    const commaIndex = cleanValue.indexOf(',');
    let integerPart = '';
    let decimalPart = '';
    
    if (commaIndex !== -1) {
      integerPart = cleanValue.substring(0, commaIndex);
      decimalPart = cleanValue.substring(commaIndex + 1).replace(/,/g, '');
    } else {
      integerPart = cleanValue;
    }
    
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    if (commaIndex !== -1) {
      return `${formattedInteger},${decimalPart}`;
    }
    return formattedInteger;
  };

  const parseFormattedNumber = (value: string): number => {
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  const handleUnitPriceChange = (text: string) => {
    const cleanText = text.replace(/[^0-9,]/g, '');
    const formatted = formatNumberWithSeparators(cleanText);
    setUnitPrice(formatted);
  };

  const handleInputFocus = (offset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: offset, animated: true });
    }, 300);
  };

  const filteredProductTypes = useMemo(() => {
    if (!productType) return suggestions.productTypes;
    return suggestions.productTypes.filter(s => 
      s.toLowerCase().includes(productType.toLowerCase())
    );
  }, [suggestions.productTypes, productType]);

  const filteredProductNames = useMemo(() => {
    if (!productName) return suggestions.productNames;
    return suggestions.productNames.filter(s => 
      s.toLowerCase().includes(productName.toLowerCase())
    );
  }, [suggestions.productNames, productName]);

  const filteredNotes = useMemo(() => {
    if (!notes) return suggestions.notes;
    return suggestions.notes.filter(s => 
      s.toLowerCase().includes(notes.toLowerCase())
    );
  }, [suggestions.notes, notes]);

  const getRawUnitPrice = (): number => {
    const rawPrice = parseFormattedNumber(unitPrice);
    
    if (currencyMode === 'USD' && exchangeRate) {
      return rawPrice * exchangeRate;
    }
    return rawPrice;
  };

  const getUnitPriceWithIVA = (): number => {
    const basePrice = getRawUnitPrice();
    switch (ivaOption) {
      case 'iva21':
        return basePrice * 1.21;
      case 'iva105':
        return basePrice * 1.105;
      default:
        return basePrice;
    }
  };

  const totalValue = (parseFloat(quantity) || 0) * getUnitPriceWithIVA();
  
  const displayConvertedPrice = useMemo(() => {
    if (currencyMode === 'USD' && exchangeRate && unitPrice) {
      const usdValue = parseFormattedNumber(unitPrice);
      const arsValue = usdValue * exchangeRate;
      return arsValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return null;
  }, [currencyMode, exchangeRate, unitPrice]);

  const handleVoiceApply = useCallback((data: ParsedVoiceData, rawText: string) => {
    console.log('[AddTransaction] Voice data applied:', data, 'raw:', rawText);
    if (data.type) setType(data.type);
    if (data.productName) setProductName(data.productName);
    if (data.productType) setProductType(data.productType);
    if (data.quantity) setQuantity(data.quantity);
    if (data.unitPrice) {
      const formatted = formatNumberWithSeparators(data.unitPrice.replace('.', ','));
      setUnitPrice(formatted);
    }
    if (data.notes) setNotes(data.notes);
  }, []);

  const handleSubmit = () => {
    if (!productName.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del producto');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Error', 'Por favor ingresa una cantidad válida');
      return;
    }
    const dateToUse = datePartsToISO(dayInput, monthInput, yearInput) ?? transactionDate;
    if (!dateToUse) {
      Alert.alert('Error', 'Por favor ingresa una fecha válida (día, mes y año).');
      return;
    }

    const finalUnitPrice = getUnitPriceWithIVA();
    
    addTransaction({
      type,
      productType: productType.trim() || undefined,
      productName: productName.trim(),
      quantity: parseFloat(quantity),
      unitPrice: finalUnitPrice,
      date: dateToUse,
      notes: notes.trim() || undefined,
    });

    console.log('[AddTransaction] Transaction added:', productName);
    
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setProductType('');
      setProductName('');
      setQuantity('');
      setUnitPrice('');
      setNotes('');
      setCurrencyMode('ARS');
      setIvaOption('final');
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      setTransactionDate(`${y}-${m}-${d}`);
      setDayInput(d);
      setMonthInput(m);
      setYearInput(String(y));
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PendingRecordingsList onApply={handleVoiceApply} />

        <TouchableOpacity
          style={styles.voiceBanner}
          onPress={() => setShowVoiceModal(true)}
          activeOpacity={0.7}
          testID="voice-input-button"
        >
          <View style={styles.voiceBannerIcon}>
            <Mic size={22} color="#FFF" />
          </View>
          <View style={styles.voiceBannerTextContainer}>
            <Text style={styles.voiceBannerTitle}>Cargar por voz</Text>
            <Text style={styles.voiceBannerSubtitle}>Dictá los datos de la transacción</Text>
          </View>
          <View style={styles.voiceBannerArrow}>
            <ChevronDown size={18} color={Colors.primary} style={{ transform: [{ rotate: '-90deg' }] }} />
          </View>
        </TouchableOpacity>

        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeOption,
              type === 'entrada' && styles.typeOptionEntrada,
            ]}
            onPress={() => setType('entrada')}
            testID="type-entrada"
          >
            <Text
              style={[
                styles.typeOptionText,
                type === 'entrada' && styles.typeOptionTextActive,
              ]}
            >
              Compra
            </Text>
            <Text
              style={[
                styles.typeDescription,
                type === 'entrada' && styles.typeDescriptionActive,
              ]}
            >
              Compra de productos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeOption,
              type === 'salida' && styles.typeOptionSalida,
            ]}
            onPress={() => setType('salida')}
            testID="type-salida"
          >
            <Text
              style={[
                styles.typeOptionText,
                type === 'salida' && styles.typeOptionTextActive,
              ]}
            >
              Venta
            </Text>
            <Text
              style={[
                styles.typeDescription,
                type === 'salida' && styles.typeDescriptionActive,
              ]}
            >
              Venta de productos
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Calendar size={18} color={Colors.textSecondary} />
              <Text style={styles.labelText}>Fecha de la transacción</Text>
            </View>
            <View style={styles.dateInputContainer}>
              <View style={styles.datePartsRow}>
                <TextInput
                  style={[styles.dateInput, styles.datePartInput]}
                  value={dayInput}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\D/g, '').slice(0, 2);
                    setDayInput(cleaned);
                    const iso = datePartsToISO(cleaned, monthInput, yearInput);
                    if (iso) setTransactionDate(iso);
                  }}
                  placeholder="DD"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="numeric"
                  maxLength={2}
                  testID="input-date-day"
                />
                <Text style={styles.dateSeparator}>/</Text>
                <TextInput
                  style={[styles.dateInput, styles.datePartInput]}
                  value={monthInput}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\D/g, '').slice(0, 2);
                    setMonthInput(cleaned);
                    const iso = datePartsToISO(dayInput, cleaned, yearInput);
                    if (iso) setTransactionDate(iso);
                  }}
                  placeholder="MM"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="numeric"
                  maxLength={2}
                  testID="input-date-month"
                />
                <Text style={styles.dateSeparator}>/</Text>
                <TextInput
                  style={[styles.dateInput, styles.datePartInput]}
                  value={yearInput}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\D/g, '').slice(0, 4);
                    setYearInput(cleaned);
                    const iso = datePartsToISO(dayInput, monthInput, cleaned);
                    if (iso) setTransactionDate(iso);
                  }}
                  placeholder="AAAA"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="numeric"
                  maxLength={4}
                  testID="input-date-year"
                />
              </View>
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => {
                  const today = new Date();
                  const y = today.getFullYear();
                  const m = String(today.getMonth() + 1).padStart(2, '0');
                  const d = String(today.getDate()).padStart(2, '0');
                  setTransactionDate(`${y}-${m}-${d}`);
                  setDayInput(d);
                  setMonthInput(m);
                  setYearInput(String(y));
                }}
              >
                <Text style={styles.todayButtonText}>Hoy</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Tags size={18} color={Colors.textSecondary} />
              <Text style={styles.labelText}>Tipo de Producto (opcional)</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Ej: Electrónica, Alimentos, etc."
                placeholderTextColor={Colors.textLight}
                value={productType}
                onChangeText={setProductType}
                onFocus={() => {
                  setShowProductTypeSuggestions(true);
                  handleInputFocus(100);
                }}
                testID="input-product-type"
              />
              {suggestions.productTypes.length > 0 && (
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowProductTypeSuggestions(!showProductTypeSuggestions)}
                >
                  <ChevronDown size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <SuggestionDropdown
              suggestions={filteredProductTypes}
              onSelect={setProductType}
              onDelete={(value) => deleteSuggestion('productTypes', value)}
              visible={showProductTypeSuggestions}
              onClose={() => setShowProductTypeSuggestions(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Package size={18} color={Colors.textSecondary} />
              <Text style={styles.labelText}>Producto</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Nombre del producto"
                placeholderTextColor={Colors.textLight}
                value={productName}
                onChangeText={setProductName}
                onFocus={() => {
                  setShowProductNameSuggestions(true);
                  handleInputFocus(180);
                }}
                testID="input-product"
              />
              {suggestions.productNames.length > 0 && (
                <TouchableOpacity 
                  style={styles.dropdownButton}
                  onPress={() => setShowProductNameSuggestions(!showProductNameSuggestions)}
                >
                  <ChevronDown size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <SuggestionDropdown
              suggestions={filteredProductNames}
              onSelect={setProductName}
              onDelete={(value) => deleteSuggestion('productNames', value)}
              visible={showProductNameSuggestions}
              onClose={() => setShowProductNameSuggestions(false)}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.inputLabel}>
                <Hash size={18} color={Colors.textSecondary} />
                <Text style={styles.labelText}>Cantidad</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={Colors.textLight}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                onFocus={() => handleInputFocus(260)}
                testID="input-quantity"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <View style={styles.inputLabel}>
                <DollarSign size={18} color={Colors.textSecondary} />
                <Text style={styles.labelText}>Precio Unit. (opcional)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="0,00"
                placeholderTextColor={Colors.textLight}
                value={unitPrice}
                onChangeText={handleUnitPriceChange}
                keyboardType="numeric"
                onFocus={() => handleInputFocus(260)}
                testID="input-price"
              />
            </View>
          </View>

          <View style={styles.currencySelector}>
            <Text style={styles.currencySelectorLabel}>Moneda del precio:</Text>
            <View style={styles.currencyOptions}>
              <TouchableOpacity
                style={[
                  styles.currencyOption,
                  currencyMode === 'ARS' && styles.currencyOptionActive,
                ]}
                onPress={() => setCurrencyMode('ARS')}
              >
                <Text style={[
                  styles.currencyOptionText,
                  currencyMode === 'ARS' && styles.currencyOptionTextActive,
                ]}>$ ARS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.currencyOption,
                  currencyMode === 'USD' && styles.currencyOptionActiveUSD,
                ]}
                onPress={() => setCurrencyMode('USD')}
              >
                <Text style={[
                  styles.currencyOptionText,
                  currencyMode === 'USD' && styles.currencyOptionTextActive,
                ]}>US$ USD</Text>
              </TouchableOpacity>
              {loadingRate && (
                <RefreshCw size={16} color={Colors.textSecondary} style={{ marginLeft: 8 }} />
              )}
            </View>
            {currencyMode === 'USD' && exchangeRate && (
              <View style={styles.conversionInfo}>
                <Text style={styles.conversionText}>
                  Cotización: $1 USD = ${exchangeRate.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                </Text>
                {displayConvertedPrice && (
                  <Text style={styles.convertedValue}>
                    Equivale a: ${displayConvertedPrice} ARS
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.ivaSelector}>
            <Text style={styles.ivaSelectorLabel}>Tipo de precio:</Text>
            <View style={styles.ivaOptions}>
              <TouchableOpacity
                style={[
                  styles.ivaOption,
                  ivaOption === 'final' && styles.ivaOptionActive,
                ]}
                onPress={() => setIvaOption('final')}
              >
                <Text style={[
                  styles.ivaOptionText,
                  ivaOption === 'final' && styles.ivaOptionTextActive,
                ]}>Precio final</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.ivaOption,
                  ivaOption === 'iva21' && styles.ivaOptionActive,
                ]}
                onPress={() => setIvaOption('iva21')}
              >
                <Text style={[
                  styles.ivaOptionText,
                  ivaOption === 'iva21' && styles.ivaOptionTextActive,
                ]}>+IVA 21%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.ivaOption,
                  ivaOption === 'iva105' && styles.ivaOptionActive,
                ]}
                onPress={() => setIvaOption('iva105')}
              >
                <Text style={[
                  styles.ivaOptionText,
                  ivaOption === 'iva105' && styles.ivaOptionTextActive,
                ]}>+IVA 10.5%</Text>
              </TouchableOpacity>
            </View>
            {ivaOption !== 'final' && unitPrice && (
              <Text style={styles.ivaCalculation}>
                Precio base: ${formatNumberWithSeparators(getRawUnitPrice().toFixed(2).replace('.', ','))} + IVA = ${formatNumberWithSeparators(getUnitPriceWithIVA().toFixed(2).replace('.', ','))}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <FileText size={18} color={Colors.textSecondary} />
              <Text style={styles.labelText}>Notas (opcional)</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="Agregar notas adicionales..."
                placeholderTextColor={Colors.textLight}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                onFocus={() => {
                  setShowNotesSuggestions(true);
                  handleInputFocus(340);
                }}
                testID="input-notes"
              />
              {suggestions.notes.length > 0 && (
                <TouchableOpacity 
                  style={[styles.dropdownButton, { top: 12 }]}
                  onPress={() => setShowNotesSuggestions(!showNotesSuggestions)}
                >
                  <ChevronDown size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <SuggestionDropdown
              suggestions={filteredNotes}
              onSelect={setNotes}
              onDelete={(value) => deleteSuggestion('notes', value)}
              visible={showNotesSuggestions}
              onClose={() => setShowNotesSuggestions(false)}
            />
          </View>

          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Valor Total</Text>
            <Text
              style={[
                styles.totalValue,
                { color: type === 'entrada' ? Colors.entrada : Colors.salida },
              ]}
            >
              ${totalValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: type === 'entrada' ? Colors.entrada : Colors.salida },
              showSuccess && styles.submitButtonSuccess,
            ]}
            onPress={handleSubmit}
            disabled={showSuccess}
            testID="submit-button"
          >
            {showSuccess ? (
              <>
                <Check size={22} color={Colors.textInverse} />
                <Text style={styles.submitButtonText}>¡Registrado!</Text>
              </>
            ) : (
              <Text style={styles.submitButtonText}>
                Registrar {type === 'entrada' ? 'Compra' : 'Venta'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <VoiceInputModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onApply={handleVoiceApply}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  voiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '0D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  voiceBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBannerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  voiceBannerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  voiceBannerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  voiceBannerArrow: {
    marginLeft: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeOption: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  typeOptionEntrada: {
    borderColor: Colors.entrada,
    backgroundColor: Colors.entrada + '10',
  },
  typeOptionSalida: {
    borderColor: Colors.salida,
    backgroundColor: Colors.salida + '10',
  },
  typeOptionText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  typeOptionTextActive: {
    color: Colors.text,
  },
  typeDescription: {
    fontSize: 13,
    color: Colors.textLight,
  },
  typeDescriptionActive: {
    color: Colors.textSecondary,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
    zIndex: 1,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 44,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdownButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  suggestionDropdown: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }),
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  suggestionList: {
    maxHeight: 130,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 15,
    color: Colors.text,
  },
  suggestionDeleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  currencySelector: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencySelectorLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  currencyOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyOptionActive: {
    backgroundColor: Colors.entrada + '20',
    borderColor: Colors.entrada,
  },
  currencyOptionActiveUSD: {
    backgroundColor: '#22C55E20',
    borderColor: '#22C55E',
  },
  currencyOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  currencyOptionTextActive: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  conversionInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  conversionText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  convertedValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#22C55E',
    marginTop: 4,
  },
  ivaSelector: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ivaSelectorLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  ivaOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  ivaOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  ivaOptionActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  ivaOptionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  ivaOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  ivaCalculation: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  totalContainer: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '700' as const,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  submitButtonSuccess: {
    backgroundColor: Colors.success,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datePartsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  datePartInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    fontSize: 16,
    color: Colors.text,
    minWidth: 0,
  },
  dateSeparator: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginHorizontal: 2,
  },
  dateInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  todayButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
  },
  voiceArea: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  voiceHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  listeningContainer: {
    alignItems: 'center',
    gap: 12,
  },
  listeningWaves: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
  },
  listeningWaveBar: {
    width: 5,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  listeningText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  processingContainer: {
    alignItems: 'center',
    gap: 10,
  },
  processingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
    lineHeight: 20,
  },
  transcriptContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    width: '100%',
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  transcriptText: {
    fontSize: 15,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  micButtonRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  micButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: `0 4px 8px ${Colors.primary}4D`,
      },
    }),
  },
  micButtonActive: {
    backgroundColor: Colors.danger,
    ...Platform.select({
      ios: {
        shadowColor: Colors.danger,
      },
      web: {
        boxShadow: `0 4px 8px ${Colors.danger}4D`,
      },
    }),
  },
  micButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  manualInputSection: {
    marginBottom: 16,
  },
  manualInputLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  manualInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  nativeHintContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  nativeHintTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  nativeHintText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  parsedPreview: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    marginBottom: 16,
  },
  parsedPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  parsedPreviewTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  parsedFields: {
    gap: 8,
  },
  parsedField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parsedFieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    width: 70,
  },
  parsedFieldValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  parsedFieldBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  parsedFieldBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  parsedFieldEmpty: {
    fontSize: 13,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modalApplyButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    gap: 8,
  },
  modalApplyButtonDisabled: {
    opacity: 0.4,
  },
  modalApplyText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  nativeRecordHintContainer: {
    alignItems: 'center',
    gap: 12,
  },
  recordingTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.danger,
  },
  recordingTimerText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  recordingDoneContainer: {
    alignItems: 'center',
    gap: 8,
  },
  recordingDoneTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  recordingDoneSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  playbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  playbackButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  savedSuccessContainer: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  savedSuccessText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  saveRecordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.accent + '15',
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    marginBottom: 4,
  },
  saveRecordingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  pendingSection: {
    marginBottom: 20,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pendingSectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  pendingSectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  pendingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    marginBottom: 10,
    overflow: 'hidden',
  },
  pendingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  pendingCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pendingCardTextCol: {
    flex: 1,
  },
  pendingCardDate: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  pendingCardDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pendingCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pendingPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingCardExpanded: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  pendingExpandedLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  pendingTextInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  pendingApplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  pendingApplyText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFF',
  },
});
