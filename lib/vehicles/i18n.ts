import type { AgencyRole } from '@/lib/agency/types';
import {
  DEFAULT_TIMEZONE,
  formatTndFromMillimes,
  type SupportedLocale,
} from '@/lib/currency';
import type {
  ComplianceDocumentKey,
  ComplianceStatus,
} from '@/lib/vehicles/compliance';
import type {
  PricingErrorCode,
  PricingLineItem,
  PricingPreviewSuccess,
  SeasonalRateFieldErrors,
} from '@/lib/vehicles/pricing';
import type {
  VehicleCategoryPreset,
  VehicleFieldErrors,
  VehicleFuelType,
  VehicleSortKey,
  VehicleStatus,
  VehicleTransmission,
} from '@/lib/vehicles/types';

export interface VehiclesCopy {
  roles: Record<AgencyRole, string>;
  statuses: Record<VehicleStatus, string>;
  categories: Record<VehicleCategoryPreset, string>;
  transmissions: Record<VehicleTransmission, string>;
  fuels: Record<VehicleFuelType, string>;
  sortOptions: Record<VehicleSortKey, string>;
  complianceStatuses: Record<ComplianceStatus, string>;
  complianceDocuments: Record<
    ComplianceDocumentKey,
    { label: string; shortLabel: string }
  >;
  header: {
    title: string;
    description: string;
    refresh: string;
    refreshAria: string;
    addVehicle: string;
    exportCsv: string;
    exportCsvAria: string;
  };
  migrations: {
    complianceBannerTitle: string;
    complianceBannerPrefix: string;
    complianceBannerSuffix: string;
    pricingBannerTitle: string;
    pricingBannerPrefix: string;
    pricingBannerSuffix: string;
    formPricingPrefix: string;
    formPricingSuffix: string;
    formCompliancePrefix: string;
    formComplianceSuffix: string;
    advancedPricingDisabledTitle: string;
    advancedPricingDisabledPrefix: string;
    advancedPricingDisabledSuffix: string;
    installMigration0005Tooltip: string;
    availableAfterMigration0005: string;
  };
  kpis: {
    totalLabel: string;
    totalNote: string;
    retiredNote: (count: number) => string;
    availableLabel: string;
    availableNote: string;
    rentedLabel: string;
    rentedNote: string;
    maintenanceLabel: string;
    maintenanceNote: string;
  };
  compliance: {
    expiredDocsLabel: string;
    expiringDocsLabel: (days: number) => string;
    onVehiclesCount: (count: number) => string;
    filterActive: string;
    viewExpired: string;
    viewExpiringSoon: string;
    allCompliantBanner: (days: number) => string;
    informationalNotice: string;
    refPrefix: string;
    thresholdLabel: (days: number) => string;
    notProvidedDate: string;
    expiredCountBadge: (count: number) => string;
    expiringCountBadge: (count: number) => string;
  };
  toolbar: {
    searchPlaceholder: string;
    searchAria: string;
    filtersButton: string;
    filtersOpenAria: string;
    filtersSheetTitle: string;
    filtersCloseAria: string;
    statusFilterAria: string;
    allStatuses: string;
    complianceFilterAria: string;
    complianceFilterLabel: string;
    allCompliance: string;
    complianceExpired: string;
    complianceExpiringSoon: (days: number) => string;
    complianceValid: string;
    complianceNotProvided: string;
    categoryFilterAria: string;
    categoryLabel: string;
    allCategories: string;
    transmissionFilterAria: string;
    transmissionLabel: string;
    allTransmissions: string;
    allTransmissionsShort: string;
    fuelFilterAria: string;
    fuelLabel: string;
    allFuels: string;
    allFuelsShort: string;
    sortAria: string;
    sortByLabel: string;
    sortPrefix: string;
    reset: string;
    resetFilters: string;
    applyCount: (count: number) => string;
    countRatio: (shown: number, total: number) => string;
    removeChipAria: (label: string) => string;
  };
  emptyStates: {
    fleetEmptyTitle: string;
    fleetEmptyManageDesc: string;
    fleetEmptyAgentDesc: string;
    addFirstVehicle: string;
    filteredEmptyTitle: string;
    filteredEmptyDesc: string;
  };
  list: {
    colVehicle: string;
    colPlate: string;
    colSpecs: string;
    colOdometer: string;
    colDailyRate: string;
    colCompliance: string;
    colStatus: string;
    colActions: string;
    seatsShort: (count: number) => string;
    seatsFull: (count: number) => string;
    perDayShort: string;
    depositPrefix: string;
    packagesPrefix: string;
    daysShort7: string;
    daysShort30: string;
    details: string;
    edit: string;
    viewVehicleAria: (name: string) => string;
    editVehicleAria: (name: string) => string;
    footerCount: (shown: number, total: number) => string;
    agentReadOnlyFooter: string;
    close: string;
    retry: string;
  };
  feedback: {
    vehicleAdded: (name: string, plate: string) => string;
    vehicleUpdated: (name: string, plate: string) => string;
    vehicleRetired: (plate: string) => string;
    vehicleStatusChanged: (plate: string, statusLabel: string) => string;
    refreshError: string;
    refreshNetworkError: string;
  };
  drawer: {
    closeAria: string;
    expiredBannerTitle: (count: number) => string;
    expiredBannerDesc: string;
    expiringBannerTitle: (count: number, days: number) => string;
    expiringBannerDesc: string;
    sectionCompliance: string;
    sectionSpecs: string;
    sectionNotes: string;
    sectionAudit: string;
    specCategory: string;
    specTransmission: string;
    specFuel: string;
    specSeats: string;
    specOdometer: string;
    specYear: string;
    specVin: string;
    specCurrency: string;
    emptyNotes: string;
    createdAt: string;
    updatedAt: string;
    retireTitle: string;
    retireDesc: string;
    retireConfirm: string;
    reactivateTitle: string;
    reactivateDesc: string;
    reactivateConfirm: string;
    processing: string;
    cancel: string;
    retireButton: string;
    reactivateButton: string;
    agentReadOnlyNotice: string;
    statusUpdateError: string;
    statusUpdateNetworkError: string;
  };
  form: {
    createTitle: string;
    editTitle: string;
    createSubtitle: string;
    closeAria: string;
    fixFieldsError: string;
    saveErrorFallback: string;
    networkError: string;
    sectionIdentification: string;
    fieldPlate: string;
    fieldPlateHelper: string;
    fieldStatus: string;
    fieldBrand: string;
    fieldBrandPlaceholder: string;
    fieldModel: string;
    fieldModelPlaceholder: string;
    fieldYear: string;
    fieldYearHelper: string;
    fieldVin: string;
    fieldVinHelper: string;
    sectionSpecs: string;
    fieldCategory: string;
    fieldTransmission: string;
    fieldFuel: string;
    fieldSeats: string;
    fieldOdometer: string;
    sectionPricing: (currency: string) => string;
    seasonalManagedInDrawer: string;
    fieldDailyRate: (currency: string) => string;
    fieldDailyRateHelper: string;
    fieldDeposit: (currency: string) => string;
    fieldDepositHelper: string;
    fieldWeeklyRate: (currency: string) => string;
    fieldWeeklyRateHelper: string;
    fieldMonthlyRate: (currency: string) => string;
    fieldMonthlyRateHelper: string;
    recordedPreview: (formattedAmount: string) => string;
    recordedForDaysPreview: (formattedAmount: string, days: number) => string;
    sectionCompliance: string;
    datesOnlyNotice: string;
    fieldInsuranceExpiry: string;
    fieldInspectionExpiry: string;
    fieldVignetteExpiry: string;
    fieldNotes: string;
    fieldNotesHelper: string;
    fieldNotesPlaceholder: string;
    saving: string;
    saveChanges: string;
    createVehicle: string;
  };
  pricing: {
    sectionTitle: string;
    editRates: string;
    dailyRate: string;
    deposit: string;
    weeklyPackage: string;
    monthlyPackage: string;
    notDefined: string;
    seasonalRatesTitle: string;
    addPeriod: string;
    editSeasonalTitle: string;
    newSeasonalTitle: string;
    seasonalLabel: string;
    seasonalLabelPlaceholder: string;
    seasonalStartDate: string;
    seasonalEndDate: string;
    seasonalDailyRate: (currency: string) => string;
    seasonalDailyRateHelper: string;
    recordedPerDayPreview: (formattedAmount: string) => string;
    saveRule: string;
    updateRule: string;
    noSeasonalRates: string;
    defaultSeasonalLabel: string;
    active: string;
    inactive: string;
    perDayUnit: string;
    vsStandard: string;
    editSeasonalAria: (name: string) => string;
    deactivateSeasonalAria: (name: string) => string;
    reactivateSeasonalAria: (name: string) => string;
    deactivateTitle: string;
    reactivateTitle: string;
    precedenceSummary: string;
    loadRatesError: string;
    loadRatesNetworkError: string;
    saveRuleError: string;
    saveRuleNetworkError: string;
    toggleRuleError: string;
    toggleRuleNetworkError: string;
    ruleUpdatedFeedback: string;
    ruleCreatedFeedback: string;
    ruleActivatedFeedback: string;
    ruleDeactivatedFeedback: string;
  };
  simulator: {
    title: string;
    intervalMeta: (timeZone: string) => string;
    quickDurationLabel: string;
    presetDays: (days: number) => string;
    pickupDate: string;
    returnDate: string;
    chargedDuration: string;
    daysCount: (days: number) => string;
    standardDailyRate: string;
    deltaVsStandard: string;
    perDayUnit: string;
    perPackageUnit: string;
    indicativeSubtotal: (days: number) => string;
    disclaimer: string;
    errors: Record<PricingErrorCode, string>;
  };
}

const FR_COPY: VehiclesCopy = {
  roles: {
    owner: 'Propriétaire',
    manager: 'Gestionnaire',
    agent: 'Agent (lecture seule)',
  },
  statuses: {
    available: 'Disponible',
    rented: 'En location',
    maintenance: 'Maintenance',
    retired: 'Retiré',
  },
  categories: {
    economy: 'Économique',
    compact: 'Compacte',
    sedan: 'Berline',
    suv: 'SUV / 4x4',
    utility: 'Utilitaire',
    luxury: 'Luxe',
    minibus: 'Minibus',
  },
  transmissions: {
    manual: 'Manuelle',
    automatic: 'Automatique',
  },
  fuels: {
    petrol: 'Essence',
    diesel: 'Diesel',
    hybrid: 'Hybride',
    electric: 'Électrique',
    lpg: 'GPL',
  },
  sortOptions: {
    newest: 'Ajoutés récemment',
    oldest: 'Plus anciens',
    rate_asc: 'Tarif croissant',
    rate_desc: 'Tarif décroissant',
    mileage_asc: 'Kilométrage croissant',
    mileage_desc: 'Kilométrage décroissant',
    brand_asc: 'Marque (A–Z)',
    year_desc: 'Année (récent)',
  },
  complianceStatuses: {
    valid: 'Valide',
    expiring_soon: 'Expire bientôt',
    expired: 'Expiré',
    not_provided: 'Non renseigné',
  },
  complianceDocuments: {
    insurance: { label: 'Assurance', shortLabel: 'Assurance' },
    technical_inspection: {
      label: 'Visite technique',
      shortLabel: 'Visite tech.',
    },
    vignette: { label: 'Vignette', shortLabel: 'Vignette' },
  },
  header: {
    title: 'Véhicules',
    description:
      'Gérez votre parc automobile, les tarifs en TND, les cautions et le suivi des échéances administratives.',
    refresh: 'Actualiser',
    refreshAria: 'Actualiser la flotte',
    addVehicle: 'Ajouter un véhicule',
    exportCsv: 'Exporter CSV',
    exportCsvAria: 'Télécharger les véhicules affichés au format CSV',
  },
  migrations: {
    complianceBannerTitle: 'Migration des échéances en attente',
    complianceBannerPrefix: 'Appliquez',
    complianceBannerSuffix:
      'dans Supabase SQL Editor pour activer la sauvegarde des dates d’assurance, visite technique et vignette. La gestion de flotte existante reste pleinement opérationnelle.',
    pricingBannerTitle: 'Migration de tarification avancée en attente',
    pricingBannerPrefix: 'Appliquez',
    pricingBannerSuffix:
      'dans Supabase SQL Editor pour activer les forfaits 7/30 jours et les tarifs saisonniers. Le tarif journalier, la gestion de flotte et les échéances restent pleinement opérationnels.',
    formPricingPrefix: 'La migration Supabase',
    formPricingSuffix:
      'doit être installée avant d’enregistrer les forfaits 7 et 30 jours. Le tarif journalier et la caution restent pleinement modifiables.',
    formCompliancePrefix: 'La migration Supabase',
    formComplianceSuffix:
      'doit être appliquée avant de pouvoir enregistrer ces dates. Vous pouvez laisser ces champs vides pour enregistrer le véhicule dès maintenant.',
    advancedPricingDisabledTitle: 'Tarification avancée désactivée',
    advancedPricingDisabledPrefix: 'Installez la migration',
    advancedPricingDisabledSuffix:
      'dans Supabase pour enregistrer des forfaits 7/30 jours et des tarifs saisonniers. Le tarif journalier existant reste pleinement actif.',
    installMigration0005Tooltip:
      'Installez la migration 0005 dans Supabase pour activer cette action.',
    availableAfterMigration0005:
      'Disponible après installation de la migration 0005.',
  },
  kpis: {
    totalLabel: 'Total flotte',
    totalNote: 'Véhicules enregistrés',
    retiredNote: (count) => `Dont ${count} retiré${count > 1 ? 's' : ''}`,
    availableLabel: 'Disponibles',
    availableNote: 'Prêts à la location',
    rentedLabel: 'En location',
    rentedNote: 'Actuellement en circulation',
    maintenanceLabel: 'Maintenance',
    maintenanceNote: 'Immobilisés pour entretien',
  },
  compliance: {
    expiredDocsLabel: 'Documents expirés',
    expiringDocsLabel: (days) => `Expirent sous ${days} jours`,
    onVehiclesCount: (count) => `sur ${count} véhicule${count > 1 ? 's' : ''}`,
    filterActive: 'Filtre actif',
    viewExpired: 'Voir les expirés',
    viewExpiringSoon: 'Voir à renouveler',
    allCompliantBanner: (days) =>
      `Aucune échéance expirée ni à renouveler sous ${days} jours.`,
    informationalNotice:
      'Alerte informative calculée dans le fuseau horaire de l’agence — ne modifie pas automatiquement le statut du véhicule.',
    refPrefix: 'Réf.',
    thresholdLabel: (days) => `Seuil : ${days} j`,
    notProvidedDate: 'Non renseignée',
    expiredCountBadge: (count) => `${count} expirés`,
    expiringCountBadge: (count) => `${count} à renouveler`,
  },
  toolbar: {
    searchPlaceholder: 'Rechercher plaque, marque, modèle...',
    searchAria: 'Rechercher dans la flotte',
    filtersButton: 'Filtres',
    filtersOpenAria: 'Ouvrir les filtres et le tri',
    filtersSheetTitle: 'Filtres et tri',
    filtersCloseAria: 'Fermer les filtres',
    statusFilterAria: 'Filtrer par statut opérationnel',
    allStatuses: 'Tous',
    complianceFilterAria: 'Filtrer par échéances administratives',
    complianceFilterLabel: 'Échéances administratives',
    allCompliance: 'Toutes échéances',
    complianceExpired: 'Documents expirés',
    complianceExpiringSoon: (days) => `Expirent bientôt (≤ ${days} j)`,
    complianceValid: 'Échéances valides',
    complianceNotProvided: 'Dates non renseignées',
    categoryFilterAria: 'Filtrer par catégorie',
    categoryLabel: 'Catégorie',
    allCategories: 'Toutes catégories',
    transmissionFilterAria: 'Filtrer par transmission',
    transmissionLabel: 'Transmission',
    allTransmissions: 'Toutes transmissions',
    allTransmissionsShort: 'Toutes',
    fuelFilterAria: 'Filtrer par carburant',
    fuelLabel: 'Carburant',
    allFuels: 'Tous carburants',
    allFuelsShort: 'Tous',
    sortAria: 'Trier les véhicules',
    sortByLabel: 'Trier par',
    sortPrefix: 'Tri :',
    reset: 'Réinitialiser',
    resetFilters: 'Réinitialiser les filtres',
    applyCount: (count) => `Afficher ${count} véhicule${count > 1 ? 's' : ''}`,
    countRatio: (shown, total) =>
      `${shown} sur ${total} véhicule${total > 1 ? 's' : ''}`,
    removeChipAria: (label) => `Retirer le filtre ${label}`,
  },
  emptyStates: {
    fleetEmptyTitle: 'Aucun véhicule dans votre flotte',
    fleetEmptyManageDesc:
      'Votre agence ne possède encore aucun véhicule enregistré dans Supabase. Ajoutez votre premier véhicule pour démarrer l’inventaire.',
    fleetEmptyAgentDesc:
      'Votre agence ne possède encore aucun véhicule enregistré. Demandez à un propriétaire ou gestionnaire d’ajouter les véhicules du parc.',
    addFirstVehicle: 'Ajouter un premier véhicule',
    filteredEmptyTitle: 'Aucun véhicule ne correspond à vos critères',
    filteredEmptyDesc:
      'Modifiez votre recherche ou réinitialisez les filtres actifs pour afficher l’ensemble du parc.',
  },
  list: {
    colVehicle: 'Véhicule',
    colPlate: 'Immatriculation',
    colSpecs: 'Spécifications',
    colOdometer: 'Kilométrage',
    colDailyRate: 'Tarif / jour',
    colCompliance: 'Échéances',
    colStatus: 'Statut',
    colActions: 'Actions',
    seatsShort: (count) => `${count} pl.`,
    seatsFull: (count) => `${count} places`,
    perDayShort: '/j',
    depositPrefix: 'Caution :',
    packagesPrefix: 'Forfaits',
    daysShort7: '7j',
    daysShort30: '30j',
    details: 'Détails',
    edit: 'Modifier',
    viewVehicleAria: (name) => `Voir la fiche de ${name}`,
    editVehicleAria: (name) => `Modifier ${name}`,
    footerCount: (shown, total) =>
      `${shown} sur ${total} véhicule${total > 1 ? 's' : ''} affiché${shown > 1 ? 's' : ''}`,
    agentReadOnlyFooter: 'Mode consultation (Agent)',
    close: 'Fermer',
    retry: 'Réessayer',
  },
  feedback: {
    vehicleAdded: (name, plate) =>
      `Véhicule ${name} (${plate}) ajouté à la flotte.`,
    vehicleUpdated: (name, plate) => `Fiche de ${name} (${plate}) mise à jour.`,
    vehicleRetired: (plate) =>
      `Le véhicule ${plate} a été retiré du parc actif.`,
    vehicleStatusChanged: (plate, statusLabel) =>
      `Le véhicule ${plate} est désormais « ${statusLabel} ».`,
    refreshError:
      'Impossible d’actualiser la liste des véhicules depuis Supabase.',
    refreshNetworkError: 'Erreur réseau lors du chargement des véhicules.',
  },
  drawer: {
    closeAria: 'Fermer la fiche véhicule',
    expiredBannerTitle: (count) =>
      count === 1
        ? '1 échéance administrative dépassée'
        : `${count} échéances administratives dépassées`,
    expiredBannerDesc:
      'Vérifiez les justificatifs correspondants et mettez à jour la date après renouvellement. Le statut opérationnel du véhicule n’est pas modifié automatiquement.',
    expiringBannerTitle: (count, days) =>
      count === 1
        ? `1 échéance arrive à terme sous ${days} jours`
        : `${count} échéances arrivent à terme sous ${days} jours`,
    expiringBannerDesc:
      'Pensez à planifier le renouvellement avant la date limite.',
    sectionCompliance: 'Échéances administratives',
    sectionSpecs: 'Caractéristiques techniques',
    sectionNotes: 'Notes internes',
    sectionAudit: 'Suivi de la fiche',
    specCategory: 'Catégorie',
    specTransmission: 'Transmission',
    specFuel: 'Carburant',
    specSeats: 'Places',
    specOdometer: 'Kilométrage',
    specYear: 'Année',
    specVin: 'Numéro de châssis (VIN)',
    specCurrency: 'Devise',
    emptyNotes: 'Aucune note enregistrée pour ce véhicule.',
    createdAt: 'Créé le',
    updatedAt: 'Dernière mise à jour',
    retireTitle: 'Confirmer le retrait de ce véhicule du parc actif ?',
    retireDesc:
      'Le véhicule passera en statut « Retiré » sans suppression définitive afin de préserver l’historique de votre agence.',
    retireConfirm: 'Confirmer le retrait',
    reactivateTitle: 'Remettre ce véhicule en statut Disponible ?',
    reactivateDesc:
      'Le véhicule redeviendra visible dans la flotte active en statut « Disponible ».',
    reactivateConfirm: 'Confirmer la réactivation',
    processing: 'Traitement...',
    cancel: 'Annuler',
    retireButton: 'Retirer du parc',
    reactivateButton: 'Réactiver',
    agentReadOnlyNotice:
      'Accès en lecture seule (rôle Agent). Seuls les propriétaires et gestionnaires peuvent modifier un véhicule.',
    statusUpdateError: 'Impossible de mettre à jour le statut du véhicule.',
    statusUpdateNetworkError: 'Erreur réseau lors de la mise à jour du statut.',
  },
  form: {
    createTitle: 'Ajouter un véhicule',
    editTitle: 'Modifier le véhicule',
    createSubtitle:
      'Renseignez les informations techniques et tarifaires du véhicule.',
    closeAria: 'Fermer la fenêtre',
    fixFieldsError: 'Veuillez corriger les champs indiqués ci-dessous.',
    saveErrorFallback:
      'Impossible d’enregistrer le véhicule. Veuillez réessayer.',
    networkError: 'Erreur réseau lors de la communication avec le serveur.',
    sectionIdentification: 'Identification du véhicule',
    fieldPlate: 'Immatriculation',
    fieldPlateHelper: 'Unique au sein de votre agence (ex. 214 TU 4821).',
    fieldStatus: 'Statut opérationnel',
    fieldBrand: 'Marque',
    fieldBrandPlaceholder: 'Peugeot, Hyundai, Renault...',
    fieldModel: 'Modèle',
    fieldModelPlaceholder: '208, i20, Duster...',
    fieldYear: 'Année',
    fieldYearHelper: 'Entre 1980 et 2100 (optionnel).',
    fieldVin: 'Numéro de châssis (VIN)',
    fieldVinHelper: 'Optionnel, 32 caractères maximum.',
    sectionSpecs: 'Caractéristiques techniques',
    fieldCategory: 'Catégorie',
    fieldTransmission: 'Transmission',
    fieldFuel: 'Carburant',
    fieldSeats: 'Nombre de places',
    fieldOdometer: 'Kilométrage (km)',
    sectionPricing: (currency) =>
      `Tarification (${currency}, précision 3 décimales)`,
    seasonalManagedInDrawer: 'Tarifs saisonniers gérés dans la fiche véhicule',
    fieldDailyRate: (currency) => `Tarif journalier (${currency})`,
    fieldDailyRateHelper: 'Ex. 120,000 ou 95.500',
    fieldDeposit: (currency) => `Caution (${currency})`,
    fieldDepositHelper: 'Ex. 1500,000 (0 par défaut)',
    fieldWeeklyRate: (currency) => `Forfait 7 jours (${currency})`,
    fieldWeeklyRateHelper: 'Optionnel · forfait fixe pour 7 jours standards',
    fieldMonthlyRate: (currency) => `Forfait 30 jours (${currency})`,
    fieldMonthlyRateHelper: 'Optionnel · forfait fixe pour 30 jours standards',
    recordedPreview: (amount) => `Enregistré : ${amount}`,
    recordedForDaysPreview: (amount, days) =>
      `Enregistré : ${amount} pour ${days} jours`,
    sectionCompliance: 'Échéances administratives (optionnel)',
    datesOnlyNotice: 'Dates uniquement · aucun fichier requis',
    fieldInsuranceExpiry: 'Expiration assurance',
    fieldInspectionExpiry: 'Expiration visite technique',
    fieldVignetteExpiry: 'Expiration vignette',
    fieldNotes: 'Notes internes',
    fieldNotesHelper:
      'Observations d’état, équipements ou consignes d’exploitation (optionnel).',
    fieldNotesPlaceholder:
      'Ex. GPS intégré, siège bébé disponible sur demande...',
    saving: 'Enregistrement...',
    saveChanges: 'Enregistrer les modifications',
    createVehicle: 'Créer le véhicule',
  },
  pricing: {
    sectionTitle: 'Tarification',
    editRates: 'Modifier les tarifs',
    dailyRate: 'Tarif journalier',
    deposit: 'Caution',
    weeklyPackage: 'Forfait 7 jours',
    monthlyPackage: 'Forfait 30 jours',
    notDefined: 'Non défini',
    seasonalRatesTitle: 'Tarifs saisonniers',
    addPeriod: 'Ajouter une période',
    editSeasonalTitle: 'Modifier le tarif saisonnier',
    newSeasonalTitle: 'Nouveau tarif saisonnier',
    seasonalLabel: 'Libellé (optionnel)',
    seasonalLabelPlaceholder: 'Ex. Haute saison été, Vacances scolaires...',
    seasonalStartDate: 'Date de début (incluse)',
    seasonalEndDate: 'Date de fin (incluse)',
    seasonalDailyRate: (currency) =>
      `Tarif journalier saisonnier (${currency})`,
    seasonalDailyRateHelper: 'Ex. 165,000 (précision 3 décimales)',
    recordedPerDayPreview: (amount) => `Enregistré : ${amount} / jour`,
    saveRule: 'Enregistrer la règle',
    updateRule: 'Mettre à jour',
    noSeasonalRates: 'Aucun tarif saisonnier configuré pour ce véhicule.',
    defaultSeasonalLabel: 'Période saisonnière',
    active: 'Actif',
    inactive: 'Inactif',
    perDayUnit: '/ j',
    vsStandard: 'vs std.',
    editSeasonalAria: (name) => `Modifier le tarif saisonnier ${name}`,
    deactivateSeasonalAria: (name) => `Désactiver le tarif saisonnier ${name}`,
    reactivateSeasonalAria: (name) => `Réactiver le tarif saisonnier ${name}`,
    deactivateTitle: 'Désactiver',
    reactivateTitle: 'Réactiver',
    precedenceSummary:
      'Les tarifs saisonniers actifs s’appliquent jour par jour sur leurs dates incluses et sont prioritaires sur le tarif journalier standard. Les forfaits 7 jours et 30 jours s’appliquent uniquement aux blocs continus de jours standards, sans jamais traverser une période saisonnière, selon la combinaison la moins chère.',
    loadRatesError: 'Impossible de charger les tarifs saisonniers du véhicule.',
    loadRatesNetworkError:
      'Erreur réseau lors du chargement des tarifs saisonniers.',
    saveRuleError: 'Impossible d’enregistrer ce tarif saisonnier.',
    saveRuleNetworkError:
      'Erreur réseau lors de la sauvegarde du tarif saisonnier.',
    toggleRuleError: 'Impossible de modifier l’état de ce tarif saisonnier.',
    toggleRuleNetworkError:
      'Erreur réseau lors de la mise à jour du tarif saisonnier.',
    ruleUpdatedFeedback: 'Tarif saisonnier mis à jour.',
    ruleCreatedFeedback: 'Nouveau tarif saisonnier enregistré.',
    ruleActivatedFeedback: 'Tarif saisonnier réactivé.',
    ruleDeactivatedFeedback: 'Tarif saisonnier désactivé.',
  },
  simulator: {
    title: 'Simulateur de tarif',
    intervalMeta: (tz) => `Intervalle [départ, retour) · ${tz}`,
    quickDurationLabel: 'Durée rapide',
    presetDays: (days) => `${days}j`,
    pickupDate: 'Date de prise en charge',
    returnDate: 'Date de restitution (exclue)',
    chargedDuration: 'Durée facturée',
    daysCount: (days) => `${days} ${days > 1 ? 'jours' : 'jour'}`,
    standardDailyRate: 'Tarif jour std.',
    deltaVsStandard: 'Écart vs std.',
    perDayUnit: '/ j',
    perPackageUnit: '/ forfait',
    indicativeSubtotal: (days) =>
      `Sous-total indicatif (${days} ${days > 1 ? 'jours' : 'jour'})`,
    disclaimer:
      'Simulation indicative — hors caution, taxes éventuelles et frais supplémentaires.',
    errors: {
      invalid_pickup_date:
        'Indiquez une date de prise en charge valide (AAAA-MM-JJ).',
      invalid_return_date:
        'Indiquez une date de restitution valide (AAAA-MM-JJ).',
      invalid_date_range:
        'La date de restitution doit être strictement postérieure à la date de prise en charge (au moins 1 jour facturé).',
      range_too_long:
        'La durée de simulation ne peut pas dépasser 3 650 jours (10 ans).',
      invalid_vehicle_rates:
        'Les tarifs du véhicule doivent être des entiers positifs ou nuls en millimes.',
      invalid_seasonal_rule:
        'Une règle tarifaire saisonnière active contient des dates ou un montant invalide.',
      overlapping_seasonal_rules:
        'Conflit de tarifs saisonniers actifs : deux périodes actives se chevauchent.',
    },
  },
};

const EN_COPY: VehiclesCopy = {
  roles: {
    owner: 'Owner',
    manager: 'Manager',
    agent: 'Agent (read-only)',
  },
  statuses: {
    available: 'Available',
    rented: 'Rented',
    maintenance: 'Maintenance',
    retired: 'Retired',
  },
  categories: {
    economy: 'Economy',
    compact: 'Compact',
    sedan: 'Sedan',
    suv: 'SUV / 4x4',
    utility: 'Utility',
    luxury: 'Luxury',
    minibus: 'Minibus',
  },
  transmissions: {
    manual: 'Manual',
    automatic: 'Automatic',
  },
  fuels: {
    petrol: 'Petrol',
    diesel: 'Diesel',
    hybrid: 'Hybrid',
    electric: 'Electric',
    lpg: 'LPG',
  },
  sortOptions: {
    newest: 'Recently added',
    oldest: 'Oldest first',
    rate_asc: 'Rate: low to high',
    rate_desc: 'Rate: high to low',
    mileage_asc: 'Mileage: low to high',
    mileage_desc: 'Mileage: high to low',
    brand_asc: 'Brand (A–Z)',
    year_desc: 'Year (newest)',
  },
  complianceStatuses: {
    valid: 'Valid',
    expiring_soon: 'Expiring soon',
    expired: 'Expired',
    not_provided: 'Not set',
  },
  complianceDocuments: {
    insurance: { label: 'Insurance', shortLabel: 'Insurance' },
    technical_inspection: {
      label: 'Technical inspection',
      shortLabel: 'Inspection',
    },
    vignette: { label: 'Road tax vignette', shortLabel: 'Vignette' },
  },
  header: {
    title: 'Vehicles',
    description:
      'Manage your fleet inventory, TND pricing packages, security deposits, and administrative compliance deadlines.',
    refresh: 'Refresh',
    refreshAria: 'Refresh fleet inventory',
    addVehicle: 'Add vehicle',
    exportCsv: 'Export CSV',
    exportCsvAria: 'Download visible vehicles as CSV',
  },
  migrations: {
    complianceBannerTitle: 'Compliance migration pending',
    complianceBannerPrefix: 'Apply',
    complianceBannerSuffix:
      'in Supabase SQL Editor to enable saving insurance, technical inspection, and vignette expiry dates. Existing fleet management remains fully operational.',
    pricingBannerTitle: 'Advanced pricing migration pending',
    pricingBannerPrefix: 'Apply',
    pricingBannerSuffix:
      'in Supabase SQL Editor to enable 7/30-day packages and seasonal rates. Daily rates, fleet management, and compliance remain fully operational.',
    formPricingPrefix: 'Supabase migration',
    formPricingSuffix:
      'must be installed before saving 7-day and 30-day packages. Daily rate and deposit remain fully editable.',
    formCompliancePrefix: 'Supabase migration',
    formComplianceSuffix:
      'must be applied before saving these dates. You can leave these fields blank to save the vehicle right now.',
    advancedPricingDisabledTitle: 'Advanced pricing disabled',
    advancedPricingDisabledPrefix: 'Install migration',
    advancedPricingDisabledSuffix:
      'in Supabase to save 7/30-day packages and seasonal rates. Existing daily pricing remains fully active.',
    installMigration0005Tooltip:
      'Install migration 0005 in Supabase to enable this action.',
    availableAfterMigration0005: 'Available after installing migration 0005.',
  },
  kpis: {
    totalLabel: 'Total fleet',
    totalNote: 'Registered vehicles',
    retiredNote: (count) => `Including ${count} retired`,
    availableLabel: 'Available',
    availableNote: 'Ready to rent',
    rentedLabel: 'Rented',
    rentedNote: 'Currently out on hire',
    maintenanceLabel: 'Maintenance',
    maintenanceNote: 'In workshop / service',
  },
  compliance: {
    expiredDocsLabel: 'Expired documents',
    expiringDocsLabel: (days) => `Expiring within ${days} days`,
    onVehiclesCount: (count) =>
      `across ${count} vehicle${count === 1 ? '' : 's'}`,
    filterActive: 'Filter active',
    viewExpired: 'View expired',
    viewExpiringSoon: 'View due soon',
    allCompliantBanner: (days) =>
      `No expired documents or renewals due within ${days} days.`,
    informationalNotice:
      'Informational alert calculated in the agency timezone — does not automatically change the vehicle operational status.',
    refPrefix: 'Ref.',
    thresholdLabel: (days) => `Threshold: ${days}d`,
    notProvidedDate: 'Not provided',
    expiredCountBadge: (count) => `${count} expired`,
    expiringCountBadge: (count) => `${count} due soon`,
  },
  toolbar: {
    searchPlaceholder: 'Search plate, brand, model...',
    searchAria: 'Search fleet',
    filtersButton: 'Filters',
    filtersOpenAria: 'Open filters and sorting',
    filtersSheetTitle: 'Filters & sorting',
    filtersCloseAria: 'Close filters',
    statusFilterAria: 'Filter by operational status',
    allStatuses: 'All',
    complianceFilterAria: 'Filter by compliance deadlines',
    complianceFilterLabel: 'Compliance deadlines',
    allCompliance: 'All compliance',
    complianceExpired: 'Expired documents',
    complianceExpiringSoon: (days) => `Expiring soon (≤ ${days}d)`,
    complianceValid: 'Valid deadlines',
    complianceNotProvided: 'Dates not provided',
    categoryFilterAria: 'Filter by category',
    categoryLabel: 'Category',
    allCategories: 'All categories',
    transmissionFilterAria: 'Filter by transmission',
    transmissionLabel: 'Transmission',
    allTransmissions: 'All transmissions',
    allTransmissionsShort: 'All',
    fuelFilterAria: 'Filter by fuel type',
    fuelLabel: 'Fuel',
    allFuels: 'All fuel types',
    allFuelsShort: 'All',
    sortAria: 'Sort vehicles',
    sortByLabel: 'Sort by',
    sortPrefix: 'Sort:',
    reset: 'Reset',
    resetFilters: 'Reset filters',
    applyCount: (count) => `Show ${count} vehicle${count === 1 ? '' : 's'}`,
    countRatio: (shown, total) =>
      `${shown} of ${total} vehicle${total === 1 ? '' : 's'}`,
    removeChipAria: (label) => `Remove filter ${label}`,
  },
  emptyStates: {
    fleetEmptyTitle: 'No vehicles in your fleet',
    fleetEmptyManageDesc:
      'Your agency has no vehicles recorded in Supabase yet. Add your first vehicle to start building your inventory.',
    fleetEmptyAgentDesc:
      'Your agency has no vehicles recorded yet. Ask an Owner or Manager to add vehicles to the fleet.',
    addFirstVehicle: 'Add first vehicle',
    filteredEmptyTitle: 'No vehicles match your filters',
    filteredEmptyDesc:
      'Adjust your search terms or reset active filters to view your full fleet.',
  },
  list: {
    colVehicle: 'Vehicle',
    colPlate: 'License plate',
    colSpecs: 'Specifications',
    colOdometer: 'Mileage',
    colDailyRate: 'Daily rate',
    colCompliance: 'Compliance',
    colStatus: 'Status',
    colActions: 'Actions',
    seatsShort: (count) => `${count} seats`,
    seatsFull: (count) => `${count} seats`,
    perDayShort: '/d',
    depositPrefix: 'Deposit:',
    packagesPrefix: 'Packages',
    daysShort7: '7d',
    daysShort30: '30d',
    details: 'Details',
    edit: 'Edit',
    viewVehicleAria: (name) => `View details for ${name}`,
    editVehicleAria: (name) => `Edit ${name}`,
    footerCount: (shown, total) =>
      `Showing ${shown} of ${total} vehicle${total === 1 ? '' : 's'}`,
    agentReadOnlyFooter: 'Read-only mode (Agent)',
    close: 'Close',
    retry: 'Retry',
  },
  feedback: {
    vehicleAdded: (name, plate) =>
      `Vehicle ${name} (${plate}) added to the fleet.`,
    vehicleUpdated: (name, plate) => `Updated ${name} (${plate}).`,
    vehicleRetired: (plate) =>
      `Vehicle ${plate} has been retired from active service.`,
    vehicleStatusChanged: (plate, statusLabel) =>
      `Vehicle ${plate} status is now “${statusLabel}”.`,
    refreshError: 'Unable to refresh the vehicle list from Supabase.',
    refreshNetworkError: 'Network error while loading vehicles.',
  },
  drawer: {
    closeAria: 'Close vehicle details',
    expiredBannerTitle: (count) =>
      count === 1
        ? '1 administrative deadline expired'
        : `${count} administrative deadlines expired`,
    expiredBannerDesc:
      'Check the corresponding documents and update the expiry date after renewal. The operational vehicle status is not altered automatically.',
    expiringBannerTitle: (count, days) =>
      count === 1
        ? `1 deadline expiring within ${days} days`
        : `${count} deadlines expiring within ${days} days`,
    expiringBannerDesc:
      'Plan the renewal ahead of the expiry date to avoid service disruption.',
    sectionCompliance: 'Administrative deadlines',
    sectionSpecs: 'Technical specifications',
    sectionNotes: 'Internal notes',
    sectionAudit: 'Record history',
    specCategory: 'Category',
    specTransmission: 'Transmission',
    specFuel: 'Fuel',
    specSeats: 'Seats',
    specOdometer: 'Mileage',
    specYear: 'Year',
    specVin: 'Chassis number (VIN)',
    specCurrency: 'Currency',
    emptyNotes: 'No internal notes recorded for this vehicle.',
    createdAt: 'Created',
    updatedAt: 'Last updated',
    retireTitle: 'Confirm retiring this vehicle from the active fleet?',
    retireDesc:
      'The vehicle will switch to “Retired” without permanent deletion so your agency history stays intact.',
    retireConfirm: 'Confirm retirement',
    reactivateTitle: 'Return this vehicle to Available status?',
    reactivateDesc:
      'The vehicle will appear again in your active fleet as “Available”.',
    reactivateConfirm: 'Confirm reactivation',
    processing: 'Processing...',
    cancel: 'Cancel',
    retireButton: 'Retire vehicle',
    reactivateButton: 'Reactivate',
    agentReadOnlyNotice:
      'Read-only access (Agent role). Only Owners and Managers can modify vehicles.',
    statusUpdateError: 'Unable to update vehicle status.',
    statusUpdateNetworkError: 'Network error while updating vehicle status.',
  },
  form: {
    createTitle: 'Add vehicle',
    editTitle: 'Edit vehicle',
    createSubtitle:
      'Enter the technical specifications and pricing rules for this vehicle.',
    closeAria: 'Close modal',
    fixFieldsError: 'Please fix the highlighted fields below.',
    saveErrorFallback: 'Unable to save the vehicle. Please try again.',
    networkError: 'Network error while communicating with the server.',
    sectionIdentification: 'Vehicle identification',
    fieldPlate: 'License plate',
    fieldPlateHelper: 'Unique within your agency (e.g. 214 TU 4821).',
    fieldStatus: 'Operational status',
    fieldBrand: 'Brand',
    fieldBrandPlaceholder: 'Peugeot, Hyundai, Renault...',
    fieldModel: 'Model',
    fieldModelPlaceholder: '208, i20, Duster...',
    fieldYear: 'Year',
    fieldYearHelper: 'Between 1980 and 2100 (optional).',
    fieldVin: 'Chassis number (VIN)',
    fieldVinHelper: 'Optional, up to 32 characters.',
    sectionSpecs: 'Technical specifications',
    fieldCategory: 'Category',
    fieldTransmission: 'Transmission',
    fieldFuel: 'Fuel type',
    fieldSeats: 'Seats',
    fieldOdometer: 'Mileage (km)',
    sectionPricing: (currency) => `Pricing (${currency}, 3-decimal precision)`,
    seasonalManagedInDrawer: 'Seasonal rates are managed in the vehicle drawer',
    fieldDailyRate: (currency) => `Daily rate (${currency})`,
    fieldDailyRateHelper: 'e.g. 120.000 or 95.500',
    fieldDeposit: (currency) => `Security deposit (${currency})`,
    fieldDepositHelper: 'e.g. 1500.000 (defaults to 0)',
    fieldWeeklyRate: (currency) => `7-day package (${currency})`,
    fieldWeeklyRateHelper: 'Optional · fixed rate for 7 standard days',
    fieldMonthlyRate: (currency) => `30-day package (${currency})`,
    fieldMonthlyRateHelper: 'Optional · fixed rate for 30 standard days',
    recordedPreview: (amount) => `Stored as: ${amount}`,
    recordedForDaysPreview: (amount, days) =>
      `Stored as: ${amount} for ${days} days`,
    sectionCompliance: 'Administrative deadlines (optional)',
    datesOnlyNotice: 'Dates only · no document upload required',
    fieldInsuranceExpiry: 'Insurance expiry',
    fieldInspectionExpiry: 'Technical inspection expiry',
    fieldVignetteExpiry: 'Vignette expiry',
    fieldNotes: 'Internal notes',
    fieldNotesHelper:
      'Condition remarks, included equipment, or operational notes (optional).',
    fieldNotesPlaceholder:
      'e.g. Built-in GPS, child seat available upon request...',
    saving: 'Saving...',
    saveChanges: 'Save changes',
    createVehicle: 'Create vehicle',
  },
  pricing: {
    sectionTitle: 'Pricing',
    editRates: 'Edit rates',
    dailyRate: 'Daily rate',
    deposit: 'Deposit',
    weeklyPackage: '7-day package',
    monthlyPackage: '30-day package',
    notDefined: 'Not set',
    seasonalRatesTitle: 'Seasonal rates',
    addPeriod: 'Add period',
    editSeasonalTitle: 'Edit seasonal rate',
    newSeasonalTitle: 'New seasonal rate',
    seasonalLabel: 'Label (optional)',
    seasonalLabelPlaceholder: 'e.g. Summer high season, School holidays...',
    seasonalStartDate: 'Start date (inclusive)',
    seasonalEndDate: 'End date (inclusive)',
    seasonalDailyRate: (currency) => `Seasonal daily rate (${currency})`,
    seasonalDailyRateHelper: 'e.g. 165.000 (3-decimal precision)',
    recordedPerDayPreview: (amount) => `Stored as: ${amount} / day`,
    saveRule: 'Save rule',
    updateRule: 'Update rule',
    noSeasonalRates: 'No seasonal rates configured for this vehicle.',
    defaultSeasonalLabel: 'Seasonal period',
    active: 'Active',
    inactive: 'Inactive',
    perDayUnit: '/ d',
    vsStandard: 'vs std.',
    editSeasonalAria: (name) => `Edit seasonal rate ${name}`,
    deactivateSeasonalAria: (name) => `Deactivate seasonal rate ${name}`,
    reactivateSeasonalAria: (name) => `Reactivate seasonal rate ${name}`,
    deactivateTitle: 'Deactivate',
    reactivateTitle: 'Reactivate',
    precedenceSummary:
      'Active seasonal rates apply day by day on their inclusive dates and take priority over the standard daily rate. 7-day and 30-day packages apply only to contiguous standard days—never crossing a seasonal period—picking the lowest-cost combination.',
    loadRatesError: 'Unable to load seasonal rates for this vehicle.',
    loadRatesNetworkError: 'Network error while loading seasonal rates.',
    saveRuleError: 'Unable to save this seasonal rate.',
    saveRuleNetworkError: 'Network error while saving the seasonal rate.',
    toggleRuleError: 'Unable to change the status of this seasonal rate.',
    toggleRuleNetworkError: 'Network error while updating the seasonal rate.',
    ruleUpdatedFeedback: 'Seasonal rate updated.',
    ruleCreatedFeedback: 'New seasonal rate saved.',
    ruleActivatedFeedback: 'Seasonal rate reactivated.',
    ruleDeactivatedFeedback: 'Seasonal rate deactivated.',
  },
  simulator: {
    title: 'Rate simulator',
    intervalMeta: (tz) => `Interval [pickup, return) · ${tz}`,
    quickDurationLabel: 'Quick duration',
    presetDays: (days) => `${days}d`,
    pickupDate: 'Pickup date',
    returnDate: 'Return date (excluded)',
    chargedDuration: 'Charged duration',
    daysCount: (days) => `${days} ${days === 1 ? 'day' : 'days'}`,
    standardDailyRate: 'Std. daily rate',
    deltaVsStandard: 'Diff. vs std.',
    perDayUnit: '/ d',
    perPackageUnit: '/ pkg',
    indicativeSubtotal: (days) =>
      `Indicative subtotal (${days} ${days === 1 ? 'day' : 'days'})`,
    disclaimer:
      'Indicative simulation — excludes deposit, applicable taxes, and extra charges.',
    errors: {
      invalid_pickup_date: 'Enter a valid pickup date (YYYY-MM-DD).',
      invalid_return_date: 'Enter a valid return date (YYYY-MM-DD).',
      invalid_date_range:
        'Return date must be strictly after pickup date (at least 1 charged day).',
      range_too_long:
        'Simulation duration cannot exceed 3,650 days (10 years).',
      invalid_vehicle_rates:
        'Vehicle rates must be valid non-negative integer millimes.',
      invalid_seasonal_rule:
        'An active seasonal pricing rule contains invalid dates or rate.',
      overlapping_seasonal_rules:
        'Active seasonal pricing conflict: two active periods overlap.',
    },
  },
};

const AR_COPY: VehiclesCopy = {
  roles: {
    owner: 'المالك',
    manager: 'المدير',
    agent: 'وكيل (قراءة فقط)',
  },
  statuses: {
    available: 'متاحة',
    rented: 'مؤجرة',
    maintenance: 'صيانة',
    retired: 'مسحوبة',
  },
  categories: {
    economy: 'اقتصادية',
    compact: 'مدمجة',
    sedan: 'سيدان',
    suv: 'دفع رباعي / SUV',
    utility: 'نفعية',
    luxury: 'فاخرة',
    minibus: 'حافلة صغيرة',
  },
  transmissions: {
    manual: 'يدوي',
    automatic: 'أوتوماتيكي',
  },
  fuels: {
    petrol: 'بنزين',
    diesel: 'ديزل',
    hybrid: 'هجين',
    electric: 'كهربائي',
    lpg: 'غاز (GPL)',
  },
  sortOptions: {
    newest: 'الأحدث إضافة',
    oldest: 'الأقدم أولاً',
    rate_asc: 'السعر: من الأقل إلى الأعلى',
    rate_desc: 'السعر: من الأعلى إلى الأقل',
    mileage_asc: 'العداد: من الأقل إلى الأعلى',
    mileage_desc: 'العداد: من الأعلى إلى الأقل',
    brand_asc: 'الماركة (أ–ي)',
    year_desc: 'السنة (الأحدث)',
  },
  complianceStatuses: {
    valid: 'سارية',
    expiring_soon: 'تنتهي قريباً',
    expired: 'منتهية',
    not_provided: 'غير محددة',
  },
  complianceDocuments: {
    insurance: { label: 'التأمين', shortLabel: 'التأمين' },
    technical_inspection: { label: 'الفحص الفني', shortLabel: 'الفحص الفني' },
    vignette: { label: 'معلوم الجولان', shortLabel: 'معلوم الجولان' },
  },
  header: {
    title: 'السيارات',
    description:
      'أدر أسطول السيارات والتعريفات بالدينار التونسي والضمانات ومواعيد الوثائق الإدارية.',
    refresh: 'تحديث',
    refreshAria: 'تحديث قائمة السيارات',
    addVehicle: 'إضافة سيارة',
    exportCsv: 'تصدير CSV',
    exportCsvAria: 'تنزيل السيارات المعروضة في ملف CSV',
  },
  migrations: {
    complianceBannerTitle: 'ترحيل الوثائق الإدارية قيد الانتظار',
    complianceBannerPrefix: 'قم بتطبيق',
    complianceBannerSuffix:
      'في محرر Supabase SQL لتفعيل حفظ تواريخ التأمين والفحص الفني ومعلوم الجولان. تبقى إدارة الأسطول الحالية فعالة بالكامل.',
    pricingBannerTitle: 'ترحيل التسعير المتقدم قيد الانتظار',
    pricingBannerPrefix: 'قم بتطبيق',
    pricingBannerSuffix:
      'في محرر Supabase SQL لتفعيل باقات 7 و30 يوماً والتعريفات الموسمية. يبقى السعر اليومي وإدارة الأسطول والمواعيد فعالة بالكامل.',
    formPricingPrefix: 'يجب تثبيت ترحيل Supabase',
    formPricingSuffix:
      'قبل حفظ باقات 7 و30 يوماً. يبقى السعر اليومي ومبلغ الضمان قابلين للتعديل بالكامل.',
    formCompliancePrefix: 'يجب تطبيق ترحيل Supabase',
    formComplianceSuffix:
      'قبل حفظ هذه التواريخ. يمكنك ترك هذه الحقول فارغة لحفظ السيارة الآن.',
    advancedPricingDisabledTitle: 'التسعير المتقدم غير مفعّل',
    advancedPricingDisabledPrefix: 'قم بتثبيت الترحيل',
    advancedPricingDisabledSuffix:
      'في Supabase لحفظ باقات 7 و30 يوماً والتعريفات الموسمية. يبقى التسعير اليومي الحالي نشطاً بالكامل.',
    installMigration0005Tooltip:
      'قم بتثبيت الترحيل 0005 في Supabase لتفعيل هذا الإجراء.',
    availableAfterMigration0005: 'متاح بعد تثبيت الترحيل 0005.',
  },
  kpis: {
    totalLabel: 'إجمالي الأسطول',
    totalNote: 'السيارات المسجلة',
    retiredNote: (count) => `منها ${count} مسحوبة`,
    availableLabel: 'متاحة',
    availableNote: 'جاهزة للإيجار',
    rentedLabel: 'مؤجرة',
    rentedNote: 'في الخدمة حالياً',
    maintenanceLabel: 'صيانة',
    maintenanceNote: 'متوقفة للصيانة',
  },
  compliance: {
    expiredDocsLabel: 'وثائق منتهية',
    expiringDocsLabel: (days) => `تنتهي خلال ${days} يوماً`,
    onVehiclesCount: (count) => `على ${count} سيارة`,
    filterActive: 'الفلتر نشط',
    viewExpired: 'عرض المنتهية',
    viewExpiringSoon: 'عرض القريبة الانتهاء',
    allCompliantBanner: (days) =>
      `لا توجد وثائق منتهية ولا مواعيد تجديد خلال ${days} يوماً.`,
    informationalNotice:
      'تنبيه معلوماتي محسوب حسب التوقيت المحلي للوكالة — لا يغيّر حالة السيارة التشغيلية تلقائياً.',
    refPrefix: 'المرجع',
    thresholdLabel: (days) => `الحد: ${days} يوم`,
    notProvidedDate: 'غير محددة',
    expiredCountBadge: (count) => `${count} منتهية`,
    expiringCountBadge: (count) => `${count} للتجديد`,
  },
  toolbar: {
    searchPlaceholder: 'ابحث بالترقيم، الماركة، الموديل...',
    searchAria: 'البحث في الأسطول',
    filtersButton: 'الفلاتر',
    filtersOpenAria: 'فتح الفلاتر والترتيب',
    filtersSheetTitle: 'الفلاتر والترتيب',
    filtersCloseAria: 'إغلاق الفلاتر',
    statusFilterAria: 'تصفية حسب الحالة التشغيلية',
    allStatuses: 'الكل',
    complianceFilterAria: 'تصفية حسب الوثائق الإدارية',
    complianceFilterLabel: 'الوثائق الإدارية',
    allCompliance: 'كل الوثائق',
    complianceExpired: 'وثائق منتهية',
    complianceExpiringSoon: (days) => `تنتهي قريباً (≤ ${days} يوم)`,
    complianceValid: 'وثائق سارية',
    complianceNotProvided: 'تواريخ غير محددة',
    categoryFilterAria: 'تصفية حسب الفئة',
    categoryLabel: 'الفئة',
    allCategories: 'كل الفئات',
    transmissionFilterAria: 'تصفية حسب ناقل الحركة',
    transmissionLabel: 'ناقل الحركة',
    allTransmissions: 'كل نواقل الحركة',
    allTransmissionsShort: 'الكل',
    fuelFilterAria: 'تصفية حسب الوقود',
    fuelLabel: 'الوقود',
    allFuels: 'كل أنواع الوقود',
    allFuelsShort: 'الكل',
    sortAria: 'ترتيب السيارات',
    sortByLabel: 'الترتيب حسب',
    sortPrefix: 'الترتيب:',
    reset: 'إعادة ضبط',
    resetFilters: 'إعادة ضبط الفلاتر',
    applyCount: (count) => `عرض ${count} سيارة`,
    countRatio: (shown, total) => `${shown} من ${total} سيارة`,
    removeChipAria: (label) => `إزالة الفلتر ${label}`,
  },
  emptyStates: {
    fleetEmptyTitle: 'لا توجد سيارات في أسطولك بعد',
    fleetEmptyManageDesc:
      'لا تحتوي وكالتك على أي سيارات مسجلة في Supabase حالياً. أضف أول سيارة لبدء إدارة الأسطول.',
    fleetEmptyAgentDesc:
      'لا تحتوي وكالتك على أي سيارات مسجلة بعد. اطلب من المالك أو المدير إضافة سيارات الأسطول.',
    addFirstVehicle: 'إضافة أول سيارة',
    filteredEmptyTitle: 'لا توجد سيارات مطابقة لمعايير البحث',
    filteredEmptyDesc:
      'عدّل كلمات البحث أو أعد ضبط الفلاتر النشطة لعرض كامل الأسطول.',
  },
  list: {
    colVehicle: 'السيارة',
    colPlate: 'لوحة الترقيم',
    colSpecs: 'المواصفات',
    colOdometer: 'العداد',
    colDailyRate: 'السعر اليومي',
    colCompliance: 'الوثائق',
    colStatus: 'الحالة',
    colActions: 'الإجراءات',
    seatsShort: (count) => `${count} مقاعد`,
    seatsFull: (count) => `${count} مقاعد`,
    perDayShort: '/يوم',
    depositPrefix: 'الضمان:',
    packagesPrefix: 'باقات',
    daysShort7: '7أ',
    daysShort30: '30أ',
    details: 'التفاصيل',
    edit: 'تعديل',
    viewVehicleAria: (name) => `عرض بطاقة ${name}`,
    editVehicleAria: (name) => `تعديل ${name}`,
    footerCount: (shown, total) => `عرض ${shown} من ${total} سيارة`,
    agentReadOnlyFooter: 'وضع القراءة فقط (وكيل)',
    close: 'إغلاق',
    retry: 'إعادة المحاولة',
  },
  feedback: {
    vehicleAdded: (name, plate) =>
      `تمت إضافة السيارة ${name} (${plate}) إلى الأسطول.`,
    vehicleUpdated: (name, plate) => `تم تحديث بطاقة ${name} (${plate}).`,
    vehicleRetired: (plate) => `تم سحب السيارة ${plate} من الأسطول النشط.`,
    vehicleStatusChanged: (plate, statusLabel) =>
      `أصبحت حالة السيارة ${plate} «${statusLabel}».`,
    refreshError: 'تعذر تحديث قائمة السيارات من Supabase.',
    refreshNetworkError: 'خطأ في الشبكة أثناء تحميل السيارات.',
  },
  drawer: {
    closeAria: 'إغلاق بطاقة السيارة',
    expiredBannerTitle: (count) =>
      count === 1 ? 'وثيقة إدارية واحدة منتهية' : `${count} وثائق إدارية منتهية`,
    expiredBannerDesc:
      'تحقق من الوثائق المعنية وحدّث التاريخ بعد التجديد. لا تتغير الحالة التشغيلية للسيارة تلقائياً.',
    expiringBannerTitle: (count, days) =>
      count === 1
        ? `وثيقة واحدة تنتهي خلال ${days} يوماً`
        : `${count} وثائق تنتهي خلال ${days} يوماً`,
    expiringBannerDesc: 'احرص على جدولة التجديد قبل حلول تاريخ الانتهاء.',
    sectionCompliance: 'المواعيد والوثائق الإدارية',
    sectionSpecs: 'المواصفات التقنية',
    sectionNotes: 'ملاحظات داخلية',
    sectionAudit: 'سجل البطاقة',
    specCategory: 'الفئة',
    specTransmission: 'ناقل الحركة',
    specFuel: 'الوقود',
    specSeats: 'المقاعد',
    specOdometer: 'العداد',
    specYear: 'السنة',
    specVin: 'رقم الهيكل (VIN)',
    specCurrency: 'العملة',
    emptyNotes: 'لا توجد ملاحظات مسجلة لهذه السيارة.',
    createdAt: 'تاريخ الإنشاء',
    updatedAt: 'آخر تحديث',
    retireTitle: 'تأكيد سحب هذه السيارة من الأسطول النشط؟',
    retireDesc:
      'ستتحول حالة السيارة إلى «مسحوبة» دون حذف نهائي للحفاظ على سجل الوكالة.',
    retireConfirm: 'تأكيد السحب',
    reactivateTitle: 'إعادة السيارة إلى حالة متاحة؟',
    reactivateDesc: 'ستظهر السيارة مجدداً ضمن الأسطول النشط بحالة «متاحة».',
    reactivateConfirm: 'تأكيد إعادة التفعيل',
    processing: 'جارٍ التنفيذ...',
    cancel: 'إلغاء',
    retireButton: 'سحب من الأسطول',
    reactivateButton: 'إعادة التفعيل',
    agentReadOnlyNotice:
      'صلاحية قراءة فقط (دور الوكيل). يمكن للمالكين والمديرين فقط تعديل السيارات.',
    statusUpdateError: 'تعذر تحديث حالة السيارة.',
    statusUpdateNetworkError: 'خطأ في الشبكة أثناء تحديث الحالة.',
  },
  form: {
    createTitle: 'إضافة سيارة',
    editTitle: 'تعديل السيارة',
    createSubtitle: 'أدخل المواصفات التقنية وقواعد التسعير الخاصة بالسيارة.',
    closeAria: 'إغلاق النافذة',
    fixFieldsError: 'يرجى تصحيح الحقول المحددة أدناه.',
    saveErrorFallback: 'تعذر حفظ السيارة. يرجى المحاولة مجدداً.',
    networkError: 'خطأ في الشبكة أثناء الاتصال بالخادم.',
    sectionIdentification: 'تعريف السيارة',
    fieldPlate: 'لوحة الترقيم',
    fieldPlateHelper: 'فريدة داخل وكالتك (مثال: 214 TU 4821).',
    fieldStatus: 'الحالة التشغيلية',
    fieldBrand: 'الماركة',
    fieldBrandPlaceholder: 'Peugeot, Hyundai, Renault...',
    fieldModel: 'الموديل',
    fieldModelPlaceholder: '208, i20, Duster...',
    fieldYear: 'السنة',
    fieldYearHelper: 'بين 1980 و2100 (اختياري).',
    fieldVin: 'رقم الهيكل (VIN)',
    fieldVinHelper: 'اختياري، 32 حرفاً كحد أقصى.',
    sectionSpecs: 'المواصفات التقنية',
    fieldCategory: 'الفئة',
    fieldTransmission: 'ناقل الحركة',
    fieldFuel: 'الوقود',
    fieldSeats: 'عدد المقاعد',
    fieldOdometer: 'العداد (كم)',
    sectionPricing: (currency) => `التسعير (${currency}، دقة 3 أرقام عشرية)`,
    seasonalManagedInDrawer: 'تُدار التعريفات الموسمية من داخل بطاقة السيارة',
    fieldDailyRate: (currency) => `السعر اليومي (${currency})`,
    fieldDailyRateHelper: 'مثال: 120,000 أو 95.500',
    fieldDeposit: (currency) => `مبلغ الضمان (${currency})`,
    fieldDepositHelper: 'مثال: 1500,000 (0 افتراضياً)',
    fieldWeeklyRate: (currency) => `باقة 7 أيام (${currency})`,
    fieldWeeklyRateHelper: 'اختياري · سعر ثابت لمدة 7 أيام قياسية',
    fieldMonthlyRate: (currency) => `باقة 30 يوماً (${currency})`,
    fieldMonthlyRateHelper: 'اختياري · سعر ثابت لمدة 30 يوماً قياسياً',
    recordedPreview: (amount) => `القيمة المحفوظة: ${amount}`,
    recordedForDaysPreview: (amount, days) =>
      `القيمة المحفوظة: ${amount} لمدة ${days} يوماً`,
    sectionCompliance: 'الوثائق الإدارية (اختياري)',
    datesOnlyNotice: 'تواريخ فقط · لا حاجة لرفع ملفات',
    fieldInsuranceExpiry: 'انتهاء التأمين',
    fieldInspectionExpiry: 'انتهاء الفحص الفني',
    fieldVignetteExpiry: 'انتهاء معلوم الجولان',
    fieldNotes: 'ملاحظات داخلية',
    fieldNotesHelper: 'ملاحظات الحالة أو التجهيزات أو تعليمات التشغيل (اختياري).',
    fieldNotesPlaceholder: 'مثال: نظام ملاحة GPS، مقعد أطفال متاح عند الطلب...',
    saving: 'جارٍ الحفظ...',
    saveChanges: 'حفظ التعديلات',
    createVehicle: 'إنشاء السيارة',
  },
  pricing: {
    sectionTitle: 'التسعير',
    editRates: 'تعديل الأسعار',
    dailyRate: 'السعر اليومي',
    deposit: 'الضمان',
    weeklyPackage: 'باقة 7 أيام',
    monthlyPackage: 'باقة 30 يوماً',
    notDefined: 'غير محدد',
    seasonalRatesTitle: 'التعريفات الموسمية',
    addPeriod: 'إضافة فترة',
    editSeasonalTitle: 'تعديل التعريفة الموسمية',
    newSeasonalTitle: 'تعريفة موسمية جديدة',
    seasonalLabel: 'التسمية (اختياري)',
    seasonalLabelPlaceholder: 'مثال: ذروة الصيف، العطلة المدرسية...',
    seasonalStartDate: 'تاريخ البداية (مشمول)',
    seasonalEndDate: 'تاريخ النهاية (مشمول)',
    seasonalDailyRate: (currency) => `السعر اليومي الموسمي (${currency})`,
    seasonalDailyRateHelper: 'مثال: 165,000 (دقة 3 أرقام عشرية)',
    recordedPerDayPreview: (amount) => `القيمة المحفوظة: ${amount} / يوم`,
    saveRule: 'حفظ القاعدة',
    updateRule: 'تحديث القاعدة',
    noSeasonalRates: 'لم يتم إعداد أي تعريفة موسمية لهذه السيارة.',
    defaultSeasonalLabel: 'فترة موسمية',
    active: 'نشط',
    inactive: 'غير نشط',
    perDayUnit: '/ يوم',
    vsStandard: 'مقابل القياسي',
    editSeasonalAria: (name) => `تعديل التعريفة الموسمية ${name}`,
    deactivateSeasonalAria: (name) => `تعطيل التعريفة الموسمية ${name}`,
    reactivateSeasonalAria: (name) => `إعادة تفعيل التعريفة الموسمية ${name}`,
    deactivateTitle: 'تعطيل',
    reactivateTitle: 'إعادة التفعيل',
    precedenceSummary:
      'تُطبق التعريفات الموسمية النشطة يوماً بيوم على تواريخها المشمولة ولها الأولوية على السعر اليومي القياسي. تُطبق باقات 7 و30 يوماً فقط على الفترات المتصلة من الأيام القياسية دون عبور أي فترة موسمية، باختيار التركيبة الأقل كلفة.',
    loadRatesError: 'تعذر تحميل التعريفات الموسمية لهذه السيارة.',
    loadRatesNetworkError: 'خطأ في الشبكة أثناء تحميل التعريفات الموسمية.',
    saveRuleError: 'تعذر حفظ هذه التعريفة الموسمية.',
    saveRuleNetworkError: 'خطأ في الشبكة أثناء حفظ التعريفة الموسمية.',
    toggleRuleError: 'تعذر تغيير حالة هذه التعريفة الموسمية.',
    toggleRuleNetworkError: 'خطأ في الشبكة أثناء تحديث التعريفة الموسمية.',
    ruleUpdatedFeedback: 'تم تحديث التعريفة الموسمية.',
    ruleCreatedFeedback: 'تم حفظ التعريفة الموسمية الجديدة.',
    ruleActivatedFeedback: 'تم إعادة تفعيل التعريفة الموسمية.',
    ruleDeactivatedFeedback: 'تم تعطيل التعريفة الموسمية.',
  },
  simulator: {
    title: 'محاكي السعر',
    intervalMeta: (tz) => `الفترة [الاستلام، الإرجاع) · ${tz}`,
    quickDurationLabel: 'مدة سريعة',
    presetDays: (days) => `${days} يوم`,
    pickupDate: 'تاريخ الاستلام',
    returnDate: 'تاريخ الإرجاع (غير مشمول)',
    chargedDuration: 'المدة المحتسبة',
    daysCount: (days) => `${days} ${days === 1 ? 'يوم' : 'أيام'}`,
    standardDailyRate: 'السعر اليومي القياسي',
    deltaVsStandard: 'الفرق عن القياسي',
    perDayUnit: '/ يوم',
    perPackageUnit: '/ باقة',
    indicativeSubtotal: (days) =>
      `المجموع الاسترشادي (${days} ${days === 1 ? 'يوم' : 'أيام'})`,
    disclaimer:
      'محاكاة استرشادية — لا تشمل الضمان أو الضرائب المحتملة أو الرسوم الإضافية.',
    errors: {
      invalid_pickup_date: 'أدخل تاريخ استلام صحيحاً (YYYY-MM-DD).',
      invalid_return_date: 'أدخل تاريخ إرجاع صحيحاً (YYYY-MM-DD).',
      invalid_date_range:
        'يجب أن يكون تاريخ الإرجاع بعد تاريخ الاستلام بيوم واحد على الأقل.',
      range_too_long: 'لا يمكن أن تتجاوز مدة المحاكاة 3,650 يوماً (10 سنوات).',
      invalid_vehicle_rates:
        'يجب أن تكون أسعار السيارة أعداداً صحيحة غير سالبة بالمليم.',
      invalid_seasonal_rule:
        'تحتوي إحدى القواعد الموسمية النشطة على تواريخ أو مبلغ غير صالح.',
      overlapping_seasonal_rules:
        'تعارض في التعريفات الموسمية النشطة: توجد فترتان نشطتان متداخلتان.',
    },
  },
};

const VEHICLES_COPY_BY_LOCALE: Record<SupportedLocale, VehiclesCopy> = {
  fr: FR_COPY,
  en: EN_COPY,
  ar: AR_COPY,
};

export function getVehiclesCopy(locale: SupportedLocale = 'fr'): VehiclesCopy {
  return VEHICLES_COPY_BY_LOCALE[locale] ?? FR_COPY;
}

/**
 * Returns localized preset category label, while preserving custom DB category strings verbatim.
 */
export function getLocalizedVehicleCategoryLabel(
  category: string,
  locale: SupportedLocale = 'fr'
): string {
  const copy = getVehiclesCopy(locale);
  const normalized = category.trim().toLowerCase() as VehicleCategoryPreset;
  if (normalized in copy.categories) {
    return copy.categories[normalized];
  }
  return category.trim() || copy.categories.compact;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats an ISO YYYY-MM-DD date consistently as DD/MM/YYYY (or localized "Not provided" when null).
 */
export function formatIsoDateLocalized(
  isoDate: string | null | undefined,
  locale: SupportedLocale = 'fr'
): string {
  const copy = getVehiclesCopy(locale);
  if (!isoDate) return copy.compliance.notProvidedDate;
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Formats signed remaining days relative to agency today in FR / EN / AR.
 */
export function formatComplianceRelativeDaysLocalized(
  daysRemaining: number | null,
  locale: SupportedLocale = 'fr'
): string {
  const copy = getVehiclesCopy(locale);
  if (daysRemaining === null) return copy.compliance.notProvidedDate;

  if (locale === 'en') {
    if (daysRemaining < 0) {
      const overdue = Math.abs(daysRemaining);
      return overdue === 1
        ? 'Expired 1 day ago'
        : `Expired ${overdue} days ago`;
    }
    if (daysRemaining === 0) return 'Expires today';
    if (daysRemaining === 1) return 'Expires tomorrow';
    return `In ${daysRemaining} days`;
  }

  if (locale === 'ar') {
    if (daysRemaining < 0) {
      const overdue = Math.abs(daysRemaining);
      return overdue === 1 ? 'منتهية منذ يوم واحد' : `منتهية منذ ${overdue} يوم`;
    }
    if (daysRemaining === 0) return 'تنتهي اليوم';
    if (daysRemaining === 1) return 'تنتهي غداً';
    return `خلال ${daysRemaining} يوم`;
  }

  // French default
  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining);
    return overdue === 1
      ? 'Expiré depuis 1 jour'
      : `Expiré depuis ${overdue} jours`;
  }
  if (daysRemaining === 0) return 'Expire aujourd’hui';
  if (daysRemaining === 1) return 'Expire demain';
  return `Dans ${daysRemaining} jours`;
}

/**
 * Formats signed TND delta with exact 3-decimal precision.
 */
export function formatSignedDeltaTndLocalized(
  deltaMinor: number,
  locale: SupportedLocale = 'fr'
): string {
  if (deltaMinor === 0) {
    return formatTndFromMillimes(0, locale);
  }
  const sign = deltaMinor > 0 ? '+' : '−';
  return `${sign}${formatTndFromMillimes(Math.abs(deltaMinor), locale)}`;
}

/**
 * Formats odometer kilometers with Western digits for tabular clarity across FR/EN/AR.
 */
export function formatOdometerLocalized(
  km: number,
  locale: SupportedLocale = 'fr'
): string {
  const intlLocale =
    locale === 'en' ? 'en-US' : locale === 'ar' ? 'fr-TN' : 'fr-TN';
  return new Intl.NumberFormat(intlLocale).format(km);
}

/**
 * Formats an ISO timestamp in the agency timezone for the selected UI locale.
 */
export function formatDateTimeLocalized(
  iso: string,
  timeZone: string,
  locale: SupportedLocale = 'fr'
): string {
  const intlLocale =
    locale === 'en' ? 'en-GB' : locale === 'ar' ? 'ar-TN' : 'fr-TN';
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || DEFAULT_TIMEZONE,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Localizes pricing simulator line item labels while preserving user-entered seasonal rule names verbatim.
 */
export function getLocalizedLineItemLabel(
  item: PricingLineItem,
  locale: SupportedLocale = 'fr'
): string {
  const copy = getVehiclesCopy(locale);
  switch (item.kind) {
    case 'monthly_package':
      return copy.pricing.monthlyPackage;
    case 'weekly_package':
      return copy.pricing.weeklyPackage;
    case 'daily_standard':
      return locale === 'en'
        ? 'Standard daily rate'
        : locale === 'ar'
          ? 'السعر اليومي القياسي'
          : 'Tarif journalier standard';
    case 'daily_seasonal': {
      const base =
        locale === 'en'
          ? 'Seasonal rate'
          : locale === 'ar'
            ? 'تعريفة موسمية'
            : 'Tarif saisonnier';
      return item.ruleLabel ? `${base} — ${item.ruleLabel}` : base;
    }
  }
}

/**
 * Builds localized pricing explanation bullets from structured preview output
 * without modifying the deterministic pricing calculation engine.
 */
export function buildLocalizedAppliedRulesExplanation(
  preview: PricingPreviewSuccess,
  locale: SupportedLocale = 'fr'
): string[] {
  if (locale === 'fr') {
    return [...preview.appliedRulesExplanation];
  }

  const lines: string[] = [];
  const start = formatIsoDateLocalized(preview.pickupDate, locale);
  const end = formatIsoDateLocalized(preview.lastChargedDateInclusive, locale);

  if (locale === 'en') {
    lines.push(
      `Period charged: ${preview.chargedDays} ${preview.chargedDays === 1 ? 'day' : 'days'} (${start} → ${end}, return date excluded).`
    );

    if (preview.seasonalDays > 0) {
      lines.push(
        `${preview.seasonalDays} seasonal ${preview.seasonalDays === 1 ? 'day' : 'days'} charged at the active seasonal daily rate.`
      );
    }

    if (
      preview.appliedPackages.monthlyCount > 0 ||
      preview.appliedPackages.weeklyCount > 0
    ) {
      const parts: string[] = [];
      if (preview.appliedPackages.monthlyCount > 0) {
        parts.push(`${preview.appliedPackages.monthlyCount} × 30-day package`);
      }
      if (preview.appliedPackages.weeklyCount > 0) {
        parts.push(`${preview.appliedPackages.weeklyCount} × 7-day package`);
      }
      if (preview.appliedPackages.standardDailyCount > 0) {
        parts.push(
          `${preview.appliedPackages.standardDailyCount} standard ${preview.appliedPackages.standardDailyCount === 1 ? 'day' : 'days'}`
        );
      }
      lines.push(
        `Standard days optimized using the lowest-cost combination: ${parts.join(' + ')}.`
      );
    } else if (preview.standardDays > 0) {
      lines.push(
        `${preview.standardDays} standard ${preview.standardDays === 1 ? 'day' : 'days'} charged at ${formatTndFromMillimes(preview.standardDailyRateMinor, 'en')} / day.`
      );
    }

    if (preview.seasonalDays > 0 && preview.standardDays > 0) {
      lines.push(
        '7-day and 30-day packages apply only to contiguous standard blocks and never cross seasonal dates.'
      );
    }
    return lines;
  }

  // Arabic
  lines.push(
    `الفترة المحتسبة: ${preview.chargedDays} ${preview.chargedDays === 1 ? 'يوم' : 'أيام'} (${start} ← ${end}، تاريخ الإرجاع غير مشمول).`
  );

  if (preview.seasonalDays > 0) {
    lines.push(
      `${preview.seasonalDays} ${preview.seasonalDays === 1 ? 'يوم موسمي' : 'أيام موسمية'} محتسبة بالتعريفة الموسمية النشطة.`
    );
  }

  if (
    preview.appliedPackages.monthlyCount > 0 ||
    preview.appliedPackages.weeklyCount > 0
  ) {
    const parts: string[] = [];
    if (preview.appliedPackages.monthlyCount > 0) {
      parts.push(`${preview.appliedPackages.monthlyCount} × باقة 30 يوماً`);
    }
    if (preview.appliedPackages.weeklyCount > 0) {
      parts.push(`${preview.appliedPackages.weeklyCount} × باقة 7 أيام`);
    }
    if (preview.appliedPackages.standardDailyCount > 0) {
      parts.push(`${preview.appliedPackages.standardDailyCount} يوم قياسي`);
    }
    lines.push(
      `تم تحسين الأيام القياسية باختيار التركيبة الأقل كلفة: ${parts.join(' + ')}.`
    );
  } else if (preview.standardDays > 0) {
    lines.push(
      `${preview.standardDays} ${preview.standardDays === 1 ? 'يوم قياسي' : 'أيام قياسية'} بسعر ${formatTndFromMillimes(preview.standardDailyRateMinor, 'ar')} / يوم.`
    );
  }

  if (preview.seasonalDays > 0 && preview.standardDays > 0) {
    lines.push(
      'تُطبق باقات 7 و30 يوماً فقط على الأيام القياسية المتصلة ولا تعبر أبداً التواريخ الموسمية.'
    );
  }

  return lines;
}

const KNOWN_VALIDATION_TRANSLATIONS: Record<
  string,
  { en: string; ar: string }
> = {
  'Le numéro d’immatriculation est obligatoire.': {
    en: 'License plate is required.',
    ar: 'لوحة الترقيم إلزامية.',
  },
  'L’immatriculation doit contenir entre 2 et 32 caractères.': {
    en: 'License plate must be between 2 and 32 characters.',
    ar: 'يجب أن تحتوي لوحة الترقيم على 2 إلى 32 حرفاً.',
  },
  'La marque est obligatoire.': {
    en: 'Brand is required.',
    ar: 'الماركة إلزامية.',
  },
  'La marque ne doit pas dépasser 60 caractères.': {
    en: 'Brand cannot exceed 60 characters.',
    ar: 'لا يمكن أن تتجاوز الماركة 60 حرفاً.',
  },
  'Le modèle est obligatoire.': {
    en: 'Model is required.',
    ar: 'الموديل إلزامي.',
  },
  'Le modèle ne doit pas dépasser 60 caractères.': {
    en: 'Model cannot exceed 60 characters.',
    ar: 'لا يمكن أن يتجاوز الموديل 60 حرفاً.',
  },
  'Le numéro de châssis (VIN) ne doit pas dépasser 32 caractères.': {
    en: 'Chassis number (VIN) cannot exceed 32 characters.',
    ar: 'لا يمكن أن يتجاوز رقم الهيكل (VIN) 32 حرفاً.',
  },
  'L’année doit être un entier compris entre 1980 et 2100.': {
    en: 'Year must be a whole number between 1980 and 2100.',
    ar: 'يجب أن تكون السنة عدداً صحيحاً بين 1980 و2100.',
  },
  'La catégorie doit contenir entre 2 et 40 caractères.': {
    en: 'Category must be between 2 and 40 characters.',
    ar: 'يجب أن تحتوي الفئة على 2 إلى 40 حرفاً.',
  },
  'Type de transmission invalide.': {
    en: 'Invalid transmission type.',
    ar: 'نوع ناقل الحركة غير صالح.',
  },
  'Type de carburant invalide.': {
    en: 'Invalid fuel type.',
    ar: 'نوع الوقود غير صالح.',
  },
  'Le nombre de places doit être compris entre 1 et 20.': {
    en: 'Number of seats must be between 1 and 20.',
    ar: 'يجب أن يكون عدد المقاعد بين 1 و20.',
  },
  'Le kilométrage doit être un entier positif ou nul (max 5 000 000 km).': {
    en: 'Mileage must be a non-negative integer (max 5,000,000 km).',
    ar: 'يجب أن يكون العداد عدداً صحيحاً غير سالب (الحد الأقصى 5,000,000 كم).',
  },
  'Indiquez un tarif journalier valide positif en TND (max 3 décimales).': {
    en: 'Enter a valid non-negative daily rate in TND (up to 3 decimals).',
    ar: 'أدخل سعراً يومياً صحيحاً غير سالب بالدينار التونسي (حتى 3 أرقام عشرية).',
  },
  'Indiquez un forfait 7 jours valide positif ou nul en TND (max 3 décimales).': {
    en: 'Enter a valid 7-day package rate in TND (up to 3 decimals).',
    ar: 'أدخل سعر باقة 7 أيام صحيحاً بالدينار التونسي (حتى 3 أرقام عشرية).',
  },
  'Indiquez un forfait 30 jours valide positif ou nul en TND (max 3 décimales).':
    {
      en: 'Enter a valid 30-day package rate in TND (up to 3 decimals).',
      ar: 'أدخل سعر باقة 30 يوماً صحيحاً بالدينار التونسي (حتى 3 أرقام عشرية).',
    },
  'Indiquez une caution valide positive ou nulle en TND (max 3 décimales).': {
    en: 'Enter a valid non-negative deposit in TND (up to 3 decimals).',
    ar: 'أدخل مبلغ ضمان صحيحاً غير سالب بالدينار التونسي (حتى 3 أرقام عشرية).',
  },
  'Statut opérationnel invalide.': {
    en: 'Invalid operational status.',
    ar: 'الحالة التشغيلية غير صالحة.',
  },
  'Les notes ne doivent pas dépasser 2 000 caractères.': {
    en: 'Notes cannot exceed 2,000 characters.',
    ar: 'لا يمكن أن تتجاوز الملاحظات 2,000 حرف.',
  },
  'Indiquez une date d’assurance valide au format AAAA-MM-JJ (1980–2100).': {
    en: 'Enter a valid insurance expiry date (YYYY-MM-DD, 1980–2100).',
    ar: 'أدخل تاريخ انتهاء تأمين صحيحاً بصيغة YYYY-MM-DD (1980–2100).',
  },
  'Indiquez une date de visite technique valide au format AAAA-MM-JJ (1980–2100).':
    {
      en: 'Enter a valid technical inspection date (YYYY-MM-DD, 1980–2100).',
      ar: 'أدخل تاريخ فحص فني صحيحاً بصيغة YYYY-MM-DD (1980–2100).',
    },
  'Indiquez une date de vignette valide au format AAAA-MM-JJ (1980–2100).': {
    en: 'Enter a valid vignette expiry date (YYYY-MM-DD, 1980–2100).',
    ar: 'أدخل تاريخ معلوم جولان صحيحاً بصيغة YYYY-MM-DD (1980–2100).',
  },
  'Le libellé ne doit pas dépasser 80 caractères.': {
    en: 'Label cannot exceed 80 characters.',
    ar: 'لا يمكن أن تتجاوز التسمية 80 حرفاً.',
  },
  'Indiquez une date de début valide au format AAAA-MM-JJ.': {
    en: 'Enter a valid start date (YYYY-MM-DD).',
    ar: 'أدخل تاريخ بداية صحيحاً (YYYY-MM-DD).',
  },
  'Indiquez une date de fin valide au format AAAA-MM-JJ.': {
    en: 'Enter a valid end date (YYYY-MM-DD).',
    ar: 'أدخل تاريخ نهاية صحيحاً (YYYY-MM-DD).',
  },
  'La date de fin doit être postérieure ou égale à la date de début.': {
    en: 'End date must be on or after the start date.',
    ar: 'يجب أن يكون تاريخ النهاية مساوياً أو لاحقاً لتاريخ البداية.',
  },
  'Indiquez un tarif saisonnier valide positif ou nul en TND (max 3 décimales).':
    {
      en: 'Enter a valid non-negative seasonal rate in TND (up to 3 decimals).',
      ar: 'أدخل سعراً موسمياً صحيحاً غير سالب بالدينار التونسي (حتى 3 أرقام عشرية).',
    },
  'État d’activation invalide.': {
    en: 'Invalid active status.',
    ar: 'حالة التفعيل غير صالحة.',
  },
  'Chevauchement avec une autre règle saisonnière active.': {
    en: 'Overlaps with another active seasonal rule.',
    ar: 'تداخل مع قاعدة موسمية نشطة أخرى.',
  },
  'Ajustez les dates ou désactivez d’abord la règle en conflit.': {
    en: 'Adjust the dates or deactivate the conflicting rule first.',
    ar: 'عدّل التواريخ أو عطّل القاعدة المتعارضة أولاً.',
  },
};

export function localizeValidationMessage(
  message: string | undefined,
  locale: SupportedLocale = 'fr'
): string | undefined {
  if (!message || locale === 'fr') return message;
  const translated = KNOWN_VALIDATION_TRANSLATIONS[message];
  if (!translated) return message;
  return locale === 'ar' ? translated.ar : translated.en;
}

export function localizeVehicleFieldErrors(
  errors: VehicleFieldErrors,
  locale: SupportedLocale = 'fr'
): VehicleFieldErrors {
  if (locale === 'fr') return errors;
  const localized: VehicleFieldErrors = {};
  for (const [key, value] of Object.entries(errors)) {
    if (value) {
      localized[key as keyof VehicleFieldErrors] = localizeValidationMessage(
        value,
        locale
      );
    }
  }
  return localized;
}

export function localizeSeasonalFieldErrors(
  errors: SeasonalRateFieldErrors,
  locale: SupportedLocale = 'fr'
): SeasonalRateFieldErrors {
  if (locale === 'fr') return errors;
  const localized: SeasonalRateFieldErrors = {};
  for (const [key, value] of Object.entries(errors)) {
    if (value) {
      localized[key as keyof SeasonalRateFieldErrors] =
        localizeValidationMessage(value, locale);
    }
  }
  return localized;
}
