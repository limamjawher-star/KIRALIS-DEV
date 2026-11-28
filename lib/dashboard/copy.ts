import type { SupportedLocale } from '@/lib/currency';
import type { DashboardMetric } from './analytics';
import type { ReservationStatus } from '@/lib/supabase/database.types';
import type { VehicleStatus } from '@/lib/vehicles/types';

export interface CommandCenterCopy {
  heading: string; subtitle: string; workspace: string; period: string;
  liveFromDb: string; incomplete: string; missing: string;
  fleet: string; customers: string; bookings: string; bookedValue: string;
  activeRentals: string; bookedDays: string; periodCompare: string;
  compareOn: string; compareOff: string; previous: string; current: string;
  chartHeading: string; chartSub: string;
  pipeline: string; pipelineSub: string;
  heat: string; heatSub: string; less: string; more: string;
  fleetStatus: string; fleetStatusSub: string;
  upcoming: string; upcomingSub: string; noUpcoming: string;
  performance: string; performanceSub: string;
  noVehicles: string; focusAll: string; filterActive: string;
  vehicle: string; status: string; reset: string;
  noPrevious: string; noBookings: string; bookingsInfo: string;
  valueInfo: string; moneyLimited: string;
  openBookings: string; openFleet: string; openCalendar: string; openReports: string;
  showAll: string; top: string;
  statuses: Record<ReservationStatus, string>;
  fleetStatuses: Record<VehicleStatus, string>;
  metricLabels: Record<DashboardMetric, string>;
}

const fr: CommandCenterCopy = {
  heading: 'Vue d’ensemble', subtitle: 'Votre activité de location, clairement et en temps réel sur les données de l’agence.',
  workspace: 'Espace agence', period: 'Période', liveFromDb: 'Données Supabase réelles',
  incomplete: 'Historique limité aux 5 000 réservations les plus récentes : certains indicateurs peuvent être incomplets.',
  missing: 'Certaines données ne sont pas disponibles. Les indicateurs sont partiels.',
  fleet: 'Véhicules', customers: 'Clients', bookings: 'Réservations',
  bookedValue: 'Valeur réservée', activeRentals: 'Locations actives', bookedDays: 'Jours réservés',
  periodCompare: 'vs période précédente', compareOn: 'Comparer', compareOff: 'Masquer comparaison',
  previous: 'Précédente', current: 'Actuelle',
  chartHeading: 'Évolution de l’activité', chartSub: 'Basée sur la date de départ locale · valeurs réelles',
  pipeline: 'Statuts des réservations', pipelineSub: 'Répartition sur la période',
  heat: 'Activité des départs', heatSub: '182 derniers jours · nombre de réservations par jour',
  less: 'Moins', more: 'Plus',
  fleetStatus: 'État de la flotte', fleetStatusSub: 'Statuts enregistrés dans votre inventaire',
  upcoming: 'Prochains départs', upcomingSub: 'Réservations à venir, en attente ou confirmées',
  noUpcoming: 'Aucun départ prochain enregistré.',
  performance: 'Performance par véhicule', performanceSub: 'Cliquez un véhicule pour filtrer l’ensemble du tableau de bord',
  noVehicles: 'Aucun véhicule enregistré dans cette agence.', focusAll: 'Tous les véhicules',
  filterActive: 'Filtre actif', vehicle: 'Véhicule', status: 'Statut', reset: 'Effacer',
  noPrevious: 'Aucune base de comparaison', noBookings: 'Aucune réservation sur cette période.',
  bookingsInfo: 'Réservations non annulées dont le départ est dans la période.',
  valueInfo: 'Montant des réservations confirmées, actives ou terminées ; ce n’est pas de l’argent encaissé.',
  moneyLimited: 'Les montants consolidés sont actuellement pris en charge uniquement pour TND.',
  openBookings: 'Réservations', openFleet: 'Flotte', openCalendar: 'Calendrier',
  openReports: 'Rapports', showAll: 'Afficher tout', top: 'Classement',
  statuses: { draft: 'Brouillon', pending: 'En attente', confirmed: 'Confirmée', active: 'En cours', completed: 'Terminée', cancelled: 'Annulée' },
  fleetStatuses: { available: 'Disponible', rented: 'Louée', maintenance: 'Entretien', retired: 'Retirée' },
  metricLabels: { bookings: 'Réservations', bookedValue: 'Valeur réservée', rentalDays: 'Jours réservés' },
};
const en: CommandCenterCopy = {
  heading: 'Overview', subtitle: 'Your rental operations, clearly presented from real agency records.',
  workspace: 'Agency workspace', period: 'Period', liveFromDb: 'Real Supabase records',
  incomplete: 'History capped at the latest 5,000 bookings; some metrics may be incomplete.',
  missing: 'Some source data is unavailable. These metrics may be incomplete.',
  fleet: 'Vehicles', customers: 'Customers', bookings: 'Bookings',
  bookedValue: 'Booked value', activeRentals: 'Active rentals', bookedDays: 'Booked days',
  periodCompare: 'vs previous period', compareOn: 'Compare', compareOff: 'Hide comparison',
  previous: 'Previous', current: 'Current', chartHeading: 'Booking trends',
  chartSub: 'Based on agency-local pickup dates · real records',
  pipeline: 'Reservation statuses', pipelineSub: 'Current period distribution',
  heat: 'Pickup activity', heatSub: 'Past 182 days · booked pickups per day',
  less: 'Less', more: 'More', fleetStatus: 'Fleet availability',
  fleetStatusSub: 'Recorded vehicle inventory statuses',
  upcoming: 'Upcoming pickups', upcomingSub: 'Future pending or confirmed bookings',
  noUpcoming: 'No upcoming pickups on record.',
  performance: 'Performance by vehicle', performanceSub: 'Select any vehicle to filter dashboard analytics',
  noVehicles: 'No vehicles registered for this agency.', focusAll: 'All vehicles',
  filterActive: 'Filter active', vehicle: 'Vehicle', status: 'Status', reset: 'Clear',
  noPrevious: 'No comparable earlier activity', noBookings: 'No bookings in this period.',
  bookingsInfo: 'Non-cancelled reservations with pickup dates in this period.',
  valueInfo: 'Committed booking amounts only; this is not collected revenue.',
  moneyLimited: 'Consolidated booked values are supported for TND agencies only.',
  openBookings: 'Reservations', openFleet: 'Fleet', openCalendar: 'Calendar',
  openReports: 'Reports', showAll: 'Show all', top: 'Ranking',
  statuses: { draft: 'Draft', pending: 'Pending', confirmed: 'Confirmed', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' },
  fleetStatuses: { available: 'Available', rented: 'Rented', maintenance: 'Maintenance', retired: 'Retired' },
  metricLabels: { bookings: 'Reservations', bookedValue: 'Booked value', rentalDays: 'Booked rental days' },
};
const ar: CommandCenterCopy = {
  heading: 'نظرة عامة', subtitle: 'أنشطة كراء السيارات مبنية على بيانات الوكالة الفعلية.',
  workspace: 'مساحة الوكالة', period: 'الفترة', liveFromDb: 'بيانات فعلية من Supabase',
  incomplete: 'يتم عرض أحدث 5000 حجز فقط، وقد تكون بعض المؤشرات غير مكتملة.',
  missing: 'بعض البيانات غير متاحة وقد تكون المؤشرات غير مكتملة.',
  fleet: 'السيارات', customers: 'العملاء', bookings: 'الحجوزات',
  bookedValue: 'قيمة الحجوزات', activeRentals: 'كراءات جارية', bookedDays: 'أيام محجوزة',
  periodCompare: 'مقارنة بالفترة السابقة', compareOn: 'مقارنة', compareOff: 'إخفاء المقارنة',
  previous: 'السابقة', current: 'الحالية', chartHeading: 'تطور الحجوزات',
  chartSub: 'حسب تاريخ التسليم المحلي · بيانات فعلية',
  pipeline: 'حالات الحجوزات', pipelineSub: 'توزيع الحجوزات في الفترة',
  heat: 'نشاط التسليم', heatSub: 'آخر 182 يوماً · عدد الحجوزات يومياً',
  less: 'أقل', more: 'أكثر', fleetStatus: 'حالة الأسطول',
  fleetStatusSub: 'الحالات الفعلية للسيارات المسجلة',
  upcoming: 'التسليمات القادمة', upcomingSub: 'الحجوزات المعلّقة والمؤكدة القادمة',
  noUpcoming: 'لا توجد عمليات تسليم قادمة مسجلة.',
  performance: 'أداء كل سيارة', performanceSub: 'اختر سيارة لتصفية بيانات لوحة التحكم',
  noVehicles: 'لا توجد سيارات مسجلة لهذه الوكالة.', focusAll: 'جميع السيارات',
  filterActive: 'التصفية نشطة', vehicle: 'السيارة', status: 'الحالة', reset: 'مسح',
  noPrevious: 'لا توجد بيانات سابقة للمقارنة', noBookings: 'لا توجد حجوزات في هذه الفترة.',
  bookingsInfo: 'الحجوزات غير الملغاة التي يبدأ تسليمها خلال الفترة.',
  valueInfo: 'قيمة الحجوزات المؤكدة والجارية والمكتملة فقط وليست مبالغ مقبوضة.',
  moneyLimited: 'المبالغ المجمعة مدعومة حالياً للوكالات التي تستخدم الدينار التونسي فقط.',
  openBookings: 'الحجوزات', openFleet: 'الأسطول', openCalendar: 'الرزنامة',
  openReports: 'التقارير', showAll: 'عرض الكل', top: 'الترتيب',
  statuses: { draft: 'مسودة', pending: 'معلّق', confirmed: 'مؤكد', active: 'جارٍ', completed: 'مكتمل', cancelled: 'ملغى' },
  fleetStatuses: { available: 'متاحة', rented: 'مؤجرة', maintenance: 'صيانة', retired: 'خارج الخدمة' },
  metricLabels: { bookings: 'الحجوزات', bookedValue: 'قيمة الحجوزات', rentalDays: 'أيام الكراء' },
};
const LOCALES: Record<SupportedLocale, CommandCenterCopy> = { fr, en, ar };
export function getCommandCenterCopy(locale: SupportedLocale): CommandCenterCopy {
  return LOCALES[locale] ?? fr;
}
