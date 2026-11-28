import type { SupportedLocale } from '@/lib/currency';
import type { ReservationStatus } from '@/lib/supabase/database.types';

export interface ReservationCopy {
  title: string; description: string; refresh: string; newBooking: string;
  search: string; all: string; filters: string; empty: string; emptyHint: string;
  reference: string; vehicle: string; customer: string; status: string;
  pickup: string; return: string; total: string; deposit: string;
  noVehicle: string; noCustomer: string; noResults: string; createDisabled: string;
  count: (n: number) => string; pending: string; ongoing: string; upcoming: string;
  formTitle: string; formSubtitle: string; pickupPlace: string; returnPlace: string;
  notes: string; quote: string; calculating: string; quoteSuccess: string;
  create: string; creating: string; close: string; cancel: string;
  days: (n: number) => string; taxNotice: string; pendingNotice: string;
  quoteFirst: string; fromNow: string; loading: string; statusUpdating: string;
  createSuccess: string; statusSuccess: string; actionError: string;
  statuses: Record<ReservationStatus, string>;
  actions: Partial<Record<ReservationStatus, string>>;
  noRates: string;
}
const FR: ReservationCopy = {
  title: 'Réservations', description: 'Organisez les locations, vérifiez les disponibilités et suivez les départs et retours.',
  refresh: 'Actualiser', newBooking: 'Nouvelle réservation', search: 'Rechercher une référence ou un client',
  all: 'Toutes', filters: 'Statut', empty: 'Aucune réservation', emptyHint: 'Créez votre première réservation pour organiser votre planning de location.',
  reference: 'Référence', vehicle: 'Véhicule', customer: 'Client', status: 'Statut',
  pickup: 'Prise en charge', return: 'Restitution', total: 'Total TND', deposit: 'Caution',
  noVehicle: 'Ajoutez un véhicule disponible avant de réserver.', noCustomer: 'Ajoutez un client avant de réserver.',
  noResults: 'Aucune réservation ne correspond à votre recherche.', createDisabled: 'Véhicule et client requis',
  count: n => `${n} réservation${n > 1 ? 's' : ''}`, pending: 'À confirmer', ongoing: 'En cours', upcoming: 'Confirmées',
  formTitle: 'Nouvelle réservation', formSubtitle: 'Tarif calculé par le serveur · fuseau horaire de l’agence',
  pickupPlace: 'Lieu de départ (facultatif)', returnPlace: 'Lieu de retour (facultatif)', notes: 'Notes internes (facultatif)',
  quote: 'Vérifier et calculer', calculating: 'Calcul...', quoteSuccess: 'Disponibilité vérifiée',
  create: 'Créer en attente', creating: 'Enregistrement...', close: 'Fermer', cancel: 'Annuler',
  days: n => `${n} jour${n > 1 ? 's' : ''}`, taxNotice: 'Sous-total sans taxes ni réductions ; la caution est indiquée séparément.',
  pendingNotice: 'La réservation reste en attente. La confirmation vérifie à nouveau les conflits.',
  quoteFirst: 'Vérifiez le tarif avant de créer la réservation.', fromNow: 'Date et heure locales de l’agence', loading: 'Chargement...',
  statusUpdating: 'Mise à jour...', createSuccess: 'Réservation créée en attente.',
  statusSuccess: 'Statut de la réservation mis à jour.', actionError: 'Action impossible. Réessayez.',
  statuses: { draft: 'Brouillon', pending: 'En attente', confirmed: 'Confirmée', active: 'En cours', completed: 'Terminée', cancelled: 'Annulée' },
  actions: { pending: 'Soumettre', confirmed: 'Confirmer', cancelled: 'Annuler', active: 'Départ', completed: 'Retour' },
  noRates: 'Tarifs indisponibles',
};
const EN: ReservationCopy = {
  title: 'Reservations', description: 'Manage bookings, check availability, and track vehicle pickups and returns.',
  refresh: 'Refresh', newBooking: 'New reservation', search: 'Search reference or customer',
  all: 'All', filters: 'Status', empty: 'No reservations yet', emptyHint: 'Create your first booking to start organizing rentals.',
  reference: 'Reference', vehicle: 'Vehicle', customer: 'Customer', status: 'Status',
  pickup: 'Pickup', return: 'Return', total: 'Total TND', deposit: 'Deposit',
  noVehicle: 'Add an eligible vehicle before booking.', noCustomer: 'Add a customer before booking.',
  noResults: 'No reservations match your search.', createDisabled: 'Vehicle and customer required',
  count: n => `${n} reservation${n !== 1 ? 's' : ''}`, pending: 'Pending', ongoing: 'Active', upcoming: 'Confirmed',
  formTitle: 'New reservation', formSubtitle: 'Server-calculated rates · agency timezone',
  pickupPlace: 'Pickup location (optional)', returnPlace: 'Return location (optional)', notes: 'Internal notes (optional)',
  quote: 'Check and calculate', calculating: 'Calculating...', quoteSuccess: 'Availability checked',
  create: 'Create pending booking', creating: 'Saving...', close: 'Close', cancel: 'Cancel',
  days: n => `${n} day${n !== 1 ? 's' : ''}`, taxNotice: 'Subtotal excludes taxes and discounts; the deposit is shown separately.',
  pendingNotice: 'The booking remains pending. Confirmation rechecks vehicle conflicts.',
  quoteFirst: 'Check the price before creating the reservation.', fromNow: 'Agency-local date and time', loading: 'Loading...',
  statusUpdating: 'Updating...', createSuccess: 'Pending reservation created.',
  statusSuccess: 'Reservation status updated.', actionError: 'Unable to complete this action. Retry.',
  statuses: { draft: 'Draft', pending: 'Pending', confirmed: 'Confirmed', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' },
  actions: { pending: 'Submit', confirmed: 'Confirm', cancelled: 'Cancel', active: 'Pickup', completed: 'Return' },
  noRates: 'Rates unavailable',
};
const AR: ReservationCopy = {
  title: 'الحجوزات', description: 'نظّم الحجوزات وتحقّق من توفّر السيارات وتابع عمليات التسليم والإرجاع.',
  refresh: 'تحديث', newBooking: 'حجز جديد', search: 'البحث بالمرجع أو اسم العميل',
  all: 'الكل', filters: 'الحالة', empty: 'لا توجد حجوزات', emptyHint: 'أنشئ أول حجز لبدء تنظيم عمليات الكراء.',
  reference: 'المرجع', vehicle: 'السيارة', customer: 'العميل', status: 'الحالة',
  pickup: 'التسليم', return: 'الإرجاع', total: 'المجموع د.ت', deposit: 'الضمان',
  noVehicle: 'أضف سيارة صالحة للكراء أولاً.', noCustomer: 'أضف عميلاً أولاً.',
  noResults: 'لا توجد حجوزات تطابق البحث.', createDisabled: 'اختر سيارة وعميلاً',
  count: n => `${n} حجوزات`, pending: 'بانتظار التأكيد', ongoing: 'جارية', upcoming: 'مؤكدة',
  formTitle: 'حجز جديد', formSubtitle: 'التسعير على الخادم · التوقيت المحلي للوكالة',
  pickupPlace: 'مكان التسليم (اختياري)', returnPlace: 'مكان الإرجاع (اختياري)', notes: 'ملاحظات داخلية (اختياري)',
  quote: 'التحقق من السعر', calculating: 'جارٍ الحساب...', quoteSuccess: 'تم التحقق من التوفر',
  create: 'إنشاء حجز معلّق', creating: 'جارٍ الحفظ...', close: 'إغلاق', cancel: 'إلغاء',
  days: n => `${n} أيام`, taxNotice: 'المجموع دون ضرائب أو تخفيضات؛ يظهر الضمان منفصلاً.',
  pendingNotice: 'يبقى الحجز معلّقاً. يتم التحقق من التعارض مجدداً عند التأكيد.',
  quoteFirst: 'تحقق من السعر قبل إنشاء الحجز.', fromNow: 'التاريخ والوقت المحليان للوكالة', loading: 'جارٍ التحميل...',
  statusUpdating: 'جارٍ التحديث...', createSuccess: 'تم إنشاء الحجز المعلّق.',
  statusSuccess: 'تم تحديث حالة الحجز.', actionError: 'تعذّر إتمام العملية.',
  statuses: { draft: 'مسوّدة', pending: 'معلّق', confirmed: 'مؤكّد', active: 'جارٍ', completed: 'مكتمل', cancelled: 'ملغى' },
  actions: { pending: 'إرسال', confirmed: 'تأكيد', cancelled: 'إلغاء', active: 'تسليم', completed: 'إرجاع' },
  noRates: 'الأسعار غير متاحة',
};
const BY_LOCALE: Record<SupportedLocale, ReservationCopy> = { fr: FR, en: EN, ar: AR };
export function getReservationCopy(locale: SupportedLocale): ReservationCopy {
  return BY_LOCALE[locale] ?? FR;
}
