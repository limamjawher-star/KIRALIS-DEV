import type { SupportedLocale } from '@/lib/currency';
import type { BookingReportStatus } from './analytics';

export interface OperationalReportCopy {
  title: string;
  description: string;
  explanation: string;
  partialWarning: string;
  errorPrefix: string;
  bookedValue: string;
  bookedValueInfo: string;
  bookings: string;
  committed: string;
  bookedDays: string;
  avgDays: string;
  fleetSize: string;
  periodByPickup: string;
  recentBookings: string;
  statusMix: string;
  noBookings: string;
  openBookings: string;
  status: Record<BookingReportStatus, string>;
  daySuffix: (value: number) => string;
}

const fr: OperationalReportCopy = {
  title: 'Rapports opérationnels',
  description: 'Une vue factuelle des réservations et de l’activité de la flotte.',
  explanation: 'Période basée sur la date de départ dans le fuseau horaire de votre agence. Seules les réservations confirmées, en cours et terminées contribuent aux montants et jours réservés.',
  partialWarning: 'Historique volumineux : les indicateurs ne couvrent que les 5 000 réservations les plus récentes.',
  errorPrefix: 'Impossible de charger toutes les données du rapport.',
  bookedValue: 'Valeur réservée',
  bookedValueInfo: 'Ce montant ne représente pas des paiements encaissés et exclut les cautions.',
  bookings: 'Réservations',
  committed: 'Réservations confirmées ou réalisées',
  bookedDays: 'Jours réservés',
  avgDays: 'Durée moyenne',
  fleetSize: 'Flotte active',
  periodByPickup: 'Par date de départ',
  recentBookings: 'Dernières réservations de la période',
  statusMix: 'Répartition par statut',
  noBookings: 'Aucune réservation sur cette période',
  openBookings: 'Ouvrir les réservations',
  status: { draft: 'Brouillon', pending: 'En attente', confirmed: 'Confirmée', active: 'En cours', completed: 'Terminée', cancelled: 'Annulée' },
  daySuffix: n => `${n.toLocaleString('fr-TN')} j`,
};
const en: OperationalReportCopy = {
  title: 'Operational reports',
  description: 'A factual overview of booking and fleet activity.',
  explanation: 'Periods use pickup dates in your agency timezone. Only confirmed, active and completed bookings contribute to booked value and rental days.',
  partialWarning: 'Large history: these metrics include only the 5,000 most recent reservations.',
  errorPrefix: 'Unable to load all report data.',
  bookedValue: 'Booked value',
  bookedValueInfo: 'This is not cash collected and excludes deposits.',
  bookings: 'Bookings',
  committed: 'Confirmed or fulfilled bookings',
  bookedDays: 'Booked rental days',
  avgDays: 'Average length',
  fleetSize: 'Active fleet',
  periodByPickup: 'By pickup date',
  recentBookings: 'Recent bookings this period',
  statusMix: 'Booking status breakdown',
  noBookings: 'No bookings in this period',
  openBookings: 'Open reservations',
  status: { draft: 'Draft', pending: 'Pending', confirmed: 'Confirmed', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' },
  daySuffix: n => `${n.toLocaleString('en-GB')} d`,
};
const ar: OperationalReportCopy = {
  title: 'التقارير التشغيلية',
  description: 'نظرة واقعية على الحجوزات ونشاط أسطول السيارات.',
  explanation: 'تعتمد الفترة على تاريخ التسليم حسب توقيت وكالتك. تُحتسب قيمة الحجوزات والأيام المحجوزة فقط للحجوزات المؤكدة والجارية والمكتملة.',
  partialWarning: 'سجل كبير: الإحصائيات تشمل أحدث 5000 حجز فقط.',
  errorPrefix: 'تعذّر تحميل كل بيانات التقرير.',
  bookedValue: 'قيمة الحجوزات',
  bookedValueInfo: 'هذا ليس المبلغ المقبوض فعلياً، ولا يشمل الضمانات.',
  bookings: 'الحجوزات',
  committed: 'الحجوزات المؤكدة أو المكتملة',
  bookedDays: 'أيام الكراء المحجوزة',
  avgDays: 'متوسط المدة',
  fleetSize: 'الأسطول النشط',
  periodByPickup: 'حسب تاريخ التسليم',
  recentBookings: 'أحدث حجوزات الفترة',
  statusMix: 'توزيع حالات الحجوزات',
  noBookings: 'لا توجد حجوزات في هذه الفترة',
  openBookings: 'فتح الحجوزات',
  status: { draft: 'مسودة', pending: 'معلّق', confirmed: 'مؤكد', active: 'جارٍ', completed: 'مكتمل', cancelled: 'ملغى' },
  daySuffix: n => `${n.toLocaleString('ar-TN')} يوم`,
};
const LOCALES: Record<SupportedLocale, OperationalReportCopy> = { fr, en, ar };
export function getOperationalReportCopy(locale: SupportedLocale): OperationalReportCopy {
  return LOCALES[locale] ?? fr;
}
