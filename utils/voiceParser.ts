import { TransactionType } from '../types/transaction';

export interface ParsedVoiceData {
  type?: TransactionType;
  productType?: string;
  productName?: string;
  quantity?: string;
  unitPrice?: string;
  notes?: string;
}

const NUMBER_WORDS: Record<string, number> = {
  'cero': 0, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
  'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
  'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
  'veinte': 20, 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50,
  'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
  'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300,
  'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600,
  'setecientos': 700, 'ochocientos': 800, 'novecientos': 900,
  'mil': 1000, 'millón': 1000000, 'millon': 1000000,
};

function extractNumber(text: string): string | undefined {
  const numMatch = text.match(/[\d]+([.,]\d+)?/);
  if (numMatch) {
    return numMatch[0].replace('.', '').replace(',', ',');
  }
  const lower = text.toLowerCase().trim();
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (lower === word) return String(val);
  }
  return undefined;
}

function findNumberInSegment(segment: string): string | undefined {
  const numMatch = segment.match(/[\d]+([.,]\d+)?/);
  if (numMatch) {
    return numMatch[0];
  }
  const words = segment.toLowerCase().trim().split(/\s+/);
  for (const word of words) {
    if (NUMBER_WORDS[word] !== undefined) {
      return String(NUMBER_WORDS[word]);
    }
  }
  return undefined;
}

export function parseVoiceText(text: string): ParsedVoiceData {
  const result: ParsedVoiceData = {};
  const lower = text.toLowerCase().trim();
  console.log('[VoiceParser] Parsing text:', lower);

  if (lower.includes('compra') || lower.includes('entrada') || lower.includes('compré') || lower.includes('compramos')) {
    result.type = 'entrada';
  } else if (lower.includes('venta') || lower.includes('salida') || lower.includes('vendí') || lower.includes('vendimos') || lower.includes('vendo')) {
    result.type = 'salida';
  }

  const quantityPatterns = [
    /(\d+([.,]\d+)?)\s*(unidades?|kilos?|kg|gramos?|gr|litros?|lt|metros?|mt|cajas?|bolsas?|paquetes?|docenas?|toneladas?|piezas?)/i,
    /(unidades?|kilos?|kg|gramos?|gr|litros?|lt|metros?|mt|cajas?|bolsas?|paquetes?|docenas?|toneladas?|piezas?)\s*(\d+([.,]\d+)?)/i,
    /cantidad\s*:?\s*(\d+([.,]\d+)?)/i,
    /(\d+([.,]\d+)?)\s+de\s+/i,
  ];

  for (const pattern of quantityPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const num = findNumberInSegment(match[0]);
      if (num) {
        result.quantity = num;
        break;
      }
    }
  }

  const pricePatterns = [
    /(?:a|precio|por|vale|cuesta|costó|costo)\s*\$?\s*(\d+([.,]\d+)?)/i,
    /(\d+([.,]\d+)?)\s*(pesos|dólares|dolares|ars|usd)/i,
    /\$\s*(\d+([.,]\d+)?)/i,
    /precio\s*(unitario)?\s*:?\s*\$?\s*(\d+([.,]\d+)?)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = lower.match(pattern);
    if (match) {
      const num = findNumberInSegment(match[0]);
      if (num && num !== result.quantity) {
        result.unitPrice = num;
        break;
      }
    }
  }

  const productPatterns = [
    /(?:compra|venta|compré|vendí|compramos|vendimos|vendo|compro)\s+(?:de\s+)?(?:\d+\s+(?:unidades?|kilos?|kg|gramos?|litros?|cajas?|bolsas?|paquetes?|piezas?)\s+(?:de\s+)?)?([\w\s]+?)(?:\s+(?:a|precio|por|vale|cuesta)\s|$)/i,
    /(?:de\s+)([\w\s]+?)(?:\s+(?:a|precio|por|vale|cuesta)\s|\s+\d|$)/i,
    /(?:producto|artículo|articulo)\s*:?\s*([\w\s]+?)(?:\s+(?:cantidad|precio|a)\s|$)/i,
  ];

  for (const pattern of productPatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      const cleanName = name
        .replace(/^\d+\s*/, '')
        .replace(/\s*(unidades?|kilos?|kg|gramos?|litros?|cajas?|bolsas?|paquetes?)\s*/gi, '')
        .replace(/\s*(a|de|por|el|la|los|las)\s*$/gi, '')
        .trim();
      if (cleanName.length > 1) {
        result.productName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        break;
      }
    }
  }

  if (!result.productName) {
    let cleaned = lower
      .replace(/compra|venta|compré|vendí|compramos|vendimos|vendo|compro/gi, '')
      .replace(/\d+([.,]\d+)?/g, '')
      .replace(/unidades?|kilos?|kg|gramos?|litros?|cajas?|bolsas?|paquetes?|piezas?/gi, '')
      .replace(/a\s+|precio|por|pesos|dólares|dolares|ars|usd|\$/gi, '')
      .replace(/\s+de\s+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length > 1) {
      result.productName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  console.log('[VoiceParser] Parsed result:', result);
  return result;
}
