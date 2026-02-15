import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useTransactions } from '../../context/TransactionContext';
import Colors from '../../constants/colors';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react-native';
import { calculateUSDTotalFromTransactions, formatUSD } from '../../utils/exchangeRate';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MONTHS_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface MonthData {
  month: number;
  monthName: string;
  compras: number;
  ventas: number;
  comprasUSD: number;
  ventasUSD: number;
}

export default function StatsScreen() {
  const { transactions } = useTransactions();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    transactions.forEach(t => {
      const year = parseInt(t.date.substring(0, 4));
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const monthlyData = useMemo((): MonthData[] => {
    const data: MonthData[] = [];
    
    for (let month = 1; month <= 12; month++) {
      const monthStr = String(month).padStart(2, '0');
      const yearMonth = `${selectedYear}-${monthStr}`;
      
      const monthTransactions = transactions.filter(t => t.date.startsWith(yearMonth));
      
      const entradas = monthTransactions.filter(t => t.type === 'entrada');
      const salidas = monthTransactions.filter(t => t.type === 'salida');
      
      const compras = entradas.reduce((sum, t) => sum + t.totalValue, 0);
      const ventas = salidas.reduce((sum, t) => sum + t.totalValue, 0);
      const comprasUSD = calculateUSDTotalFromTransactions(entradas);
      const ventasUSD = calculateUSDTotalFromTransactions(salidas);
      
      data.push({
        month,
        monthName: MONTHS_NAMES[month - 1],
        compras,
        ventas,
        comprasUSD,
        ventasUSD,
      });
    }
    
    return data;
  }, [transactions, selectedYear]);

  const yearlyData = useMemo(() => {
    const data: { year: number; compras: number; ventas: number; comprasUSD: number; ventasUSD: number }[] = [];
    
    availableYears.forEach(year => {
      const yearTransactions = transactions.filter(t => t.date.startsWith(String(year)));
      
      const entradas = yearTransactions.filter(t => t.type === 'entrada');
      const salidas = yearTransactions.filter(t => t.type === 'salida');
      
      const compras = entradas.reduce((sum, t) => sum + t.totalValue, 0);
      const ventas = salidas.reduce((sum, t) => sum + t.totalValue, 0);
      const comprasUSD = calculateUSDTotalFromTransactions(entradas);
      const ventasUSD = calculateUSDTotalFromTransactions(salidas);
      
      data.push({ year, compras, ventas, comprasUSD, ventasUSD });
    });
    
    return data.sort((a, b) => a.year - b.year);
  }, [transactions, availableYears]);

  const maxMonthlyValue = useMemo(() => {
    return Math.max(
      ...monthlyData.map(d => Math.max(d.compras, d.ventas)),
      1
    );
  }, [monthlyData]);

  const maxYearlyValue = useMemo(() => {
    return Math.max(
      ...yearlyData.map(d => Math.max(d.compras, d.ventas)),
      1
    );
  }, [yearlyData]);

  const yearTotals = useMemo(() => {
    const compras = monthlyData.reduce((sum, d) => sum + d.compras, 0);
    const ventas = monthlyData.reduce((sum, d) => sum + d.ventas, 0);
    const comprasUSD = monthlyData.reduce((sum, d) => sum + d.comprasUSD, 0);
    const ventasUSD = monthlyData.reduce((sum, d) => sum + d.ventasUSD, 0);
    return { 
      compras, 
      ventas, 
      margen: ventas - compras,
      comprasUSD,
      ventasUSD,
      margenUSD: ventasUSD - comprasUSD,
    };
  }, [monthlyData]);

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const changeYear = (delta: number) => {
    const newYear = selectedYear + delta;
    if (availableYears.includes(newYear) || delta > 0) {
      setSelectedYear(newYear);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'monthly' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('monthly')}
        >
          <Text style={[styles.viewModeText, viewMode === 'monthly' && styles.viewModeTextActive]}>
            Por Mes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'yearly' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('yearly')}
        >
          <Text style={[styles.viewModeText, viewMode === 'yearly' && styles.viewModeTextActive]}>
            Por Año
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'monthly' && (
        <>
          <View style={styles.yearSelector}>
            <TouchableOpacity onPress={() => changeYear(-1)} style={styles.yearButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.yearText}>{selectedYear}</Text>
            <TouchableOpacity onPress={() => changeYear(1)} style={styles.yearButton}>
              <ChevronRight size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: Colors.entrada + '15' }]}>
              <View style={styles.summaryIconContainer}>
                <TrendingDown size={20} color={Colors.entrada} />
              </View>
              <Text style={styles.summaryLabel}>Total Compras</Text>
              <Text style={[styles.summaryValue, { color: Colors.entrada }]}>
                {formatCurrency(yearTotals.compras)}
              </Text>
              {yearTotals.comprasUSD > 0 && (
                <Text style={styles.summaryValueUSD}>({formatUSD(yearTotals.comprasUSD)})</Text>
              )}
            </View>
            <View style={[styles.summaryCard, { backgroundColor: Colors.salida + '15' }]}>
              <View style={styles.summaryIconContainer}>
                <TrendingUp size={20} color={Colors.salida} />
              </View>
              <Text style={styles.summaryLabel}>Total Ventas</Text>
              <Text style={[styles.summaryValue, { color: Colors.salida }]}>
                {formatCurrency(yearTotals.ventas)}
              </Text>
              {yearTotals.ventasUSD > 0 && (
                <Text style={styles.summaryValueUSD}>({formatUSD(yearTotals.ventasUSD)})</Text>
              )}
            </View>
          </View>

          <View style={styles.marginCard}>
            <Text style={styles.marginLabel}>Margen del Año</Text>
            <Text style={[
              styles.marginValue,
              { color: yearTotals.margen >= 0 ? Colors.salida : Colors.entrada }
            ]}>
              {yearTotals.margen >= 0 ? '+' : ''}{formatCurrency(yearTotals.margen)}
            </Text>
            {(yearTotals.comprasUSD > 0 || yearTotals.ventasUSD > 0) && (
              <Text style={styles.marginValueUSD}>
                ({yearTotals.margenUSD >= 0 ? '+' : ''}{formatUSD(yearTotals.margenUSD)})
              </Text>
            )}
          </View>

          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.entrada }]} />
              <Text style={styles.legendText}>Compras</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.salida }]} />
              <Text style={styles.legendText}>Ventas</Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Compras vs Ventas por Mes</Text>
            <View style={styles.chart}>
              {monthlyData.map((data, index) => {
                const comprasHeight = maxMonthlyValue > 0 
                  ? (data.compras / maxMonthlyValue) * 120 
                  : 0;
                const ventasHeight = maxMonthlyValue > 0 
                  ? (data.ventas / maxMonthlyValue) * 120 
                  : 0;
                
                return (
                  <View key={index} style={styles.barGroup}>
                    <View style={styles.barsContainer}>
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: Math.max(comprasHeight, 2), 
                            backgroundColor: Colors.entrada 
                          }
                        ]} 
                      />
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: Math.max(ventasHeight, 2), 
                            backgroundColor: Colors.salida 
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.barLabel}>{data.monthName.substring(0, 3)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Detalle por Mes</Text>
            {monthlyData.map((data, index) => (
              <View key={index} style={styles.detailRow}>
                <Text style={styles.detailMonth}>{data.monthName}</Text>
                <View style={styles.detailValues}>
                  <View style={styles.detailValueContainer}>
                    <Text style={[styles.detailValue, { color: Colors.entrada }]}>
                      {formatCurrency(data.compras)}
                    </Text>
                    {data.comprasUSD > 0 && (
                      <Text style={styles.detailValueUSD}>({formatUSD(data.comprasUSD)})</Text>
                    )}
                  </View>
                  <View style={styles.detailValueContainer}>
                    <Text style={[styles.detailValue, { color: Colors.salida }]}>
                      {formatCurrency(data.ventas)}
                    </Text>
                    {data.ventasUSD > 0 && (
                      <Text style={styles.detailValueUSD}>({formatUSD(data.ventasUSD)})</Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {viewMode === 'yearly' && (
        <>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.entrada }]} />
              <Text style={styles.legendText}>Compras</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.salida }]} />
              <Text style={styles.legendText}>Ventas</Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Compras vs Ventas por Año</Text>
            <View style={styles.yearlyChart}>
              {yearlyData.map((data, index) => {
                const comprasHeight = maxYearlyValue > 0 
                  ? (data.compras / maxYearlyValue) * 150 
                  : 0;
                const ventasHeight = maxYearlyValue > 0 
                  ? (data.ventas / maxYearlyValue) * 150 
                  : 0;
                
                return (
                  <View key={index} style={styles.yearlyBarGroup}>
                    <View style={styles.yearlyBarsContainer}>
                      <View 
                        style={[
                          styles.yearlyBar, 
                          { 
                            height: Math.max(comprasHeight, 2), 
                            backgroundColor: Colors.entrada 
                          }
                        ]} 
                      />
                      <View 
                        style={[
                          styles.yearlyBar, 
                          { 
                            height: Math.max(ventasHeight, 2), 
                            backgroundColor: Colors.salida 
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.yearlyBarLabel}>{data.year}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Detalle por Año</Text>
            {yearlyData.map((data, index) => {
              const margen = data.ventas - data.compras;
              const margenUSD = data.ventasUSD - data.comprasUSD;
              return (
                <View key={index} style={styles.yearlyDetailCard}>
                  <Text style={styles.yearlyDetailYear}>{data.year}</Text>
                  <View style={styles.yearlyDetailRow}>
                    <Text style={styles.yearlyDetailLabel}>Compras:</Text>
                    <View style={styles.yearlyDetailValueContainer}>
                      <Text style={[styles.yearlyDetailValue, { color: Colors.entrada }]}>
                        {formatCurrency(data.compras)}
                      </Text>
                      {data.comprasUSD > 0 && (
                        <Text style={styles.yearlyDetailValueUSD}>({formatUSD(data.comprasUSD)})</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.yearlyDetailRow}>
                    <Text style={styles.yearlyDetailLabel}>Ventas:</Text>
                    <View style={styles.yearlyDetailValueContainer}>
                      <Text style={[styles.yearlyDetailValue, { color: Colors.salida }]}>
                        {formatCurrency(data.ventas)}
                      </Text>
                      {data.ventasUSD > 0 && (
                        <Text style={styles.yearlyDetailValueUSD}>({formatUSD(data.ventasUSD)})</Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.yearlyDetailRow, styles.yearlyDetailMargin]}>
                    <Text style={styles.yearlyDetailLabel}>Margen:</Text>
                    <View style={styles.yearlyDetailValueContainer}>
                      <Text style={[
                        styles.yearlyDetailValue, 
                        { color: margen >= 0 ? Colors.salida : Colors.entrada }
                      ]}>
                        {margen >= 0 ? '+' : ''}{formatCurrency(margen)}
                      </Text>
                      {(data.comprasUSD > 0 || data.ventasUSD > 0) && (
                        <Text style={styles.yearlyDetailValueUSD}>
                          ({margenUSD >= 0 ? '+' : ''}{formatUSD(margenUSD)})
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
      
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  viewModeContainer: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  viewModeTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  yearButton: {
    padding: 8,
  },
  yearText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginHorizontal: 20,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryIconContainer: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  summaryValueUSD: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  marginCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  marginLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  marginValue: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  marginValueUSD: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  chartContainer: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: 20,
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 120,
  },
  bar: {
    width: 8,
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 8,
    fontWeight: '500',
  },
  yearlyChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
    paddingTop: 20,
  },
  yearlyBarGroup: {
    alignItems: 'center',
    flex: 1,
  },
  yearlyBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 150,
  },
  yearlyBar: {
    width: 24,
    borderRadius: 6,
  },
  yearlyBarLabel: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 12,
    fontWeight: '600',
  },
  detailsContainer: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailMonth: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  detailValues: {
    flexDirection: 'row',
    gap: 16,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'right' as const,
  },
  detailValueContainer: {
    alignItems: 'flex-end' as const,
    minWidth: 90,
  },
  detailValueUSD: {
    fontSize: 10,
    color: Colors.textLight,
    textAlign: 'right' as const,
  },
  yearlyDetailCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  yearlyDetailYear: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  yearlyDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  yearlyDetailMargin: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 0,
  },
  yearlyDetailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  yearlyDetailValue: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  yearlyDetailValueContainer: {
    alignItems: 'flex-end' as const,
  },
  yearlyDetailValueUSD: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  bottomPadding: {
    height: 24,
  },
});
