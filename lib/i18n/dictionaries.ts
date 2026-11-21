import type { SupportedLocale } from '../currency';
import type { ModuleKey, NavGroupId } from '../navigation';
import type { ValidationErrorCode } from '../settings-validation';

export interface ModuleCopy {
  navLabel: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  plannedFeatureSummary: string;
}

export interface Dictionary {
  dir: 'ltr' | 'rtl';
  localeLabel: string;
  brandSubtitle: string;
  navGroups: Record<NavGroupId, string>;
  modules: Record<ModuleKey, ModuleCopy>;
  common: {
    phase1Label: string;
    phase1NoticeTitle: string;
    phase1NoticeBody: string;
    moduleNotImplemented: string;
    plannedFor: string;
    noDatabaseConnected: string;
    zeroRecords: string;
    searchPlaceholder: string;
    resetFilters: string;
    allFilter: string;
    toggleThemeLight: string;
    toggleThemeDark: string;
    openNavigation: string;
    closeNavigation: string;
    collapseSidebar: string;
    expandSidebar: string;
    languageSelectorLabel: string;
    currencyLabel: string;
    timezoneLabel: string;
    marketLabel: string;
    tunisia: string;
    workspace: string;
    noFilterMatch: string;
    upcomingActionNote: string;
  };
  dashboard: {
    metricsHeading: string;
    metricsFootnote: string;
    kpiFleet: string;
    kpiActiveRentals: string;
    kpiPendingReturns: string;
    kpiMonthlyRevenue: string;
    kpiSubZero: string;
    kpiSubNoDb: string;
    modulesHeading: string;
    modulesSubheading: string;
    openModule: string;
    statusFoundation: string;
    quickReadinessHeading: string;
    readinessItems: readonly {
      title: string;
      detail: string;
      status: string;
    }[];
  };
  tables: {
    vehicles: {
      filters: { all: string; available: string; rented: string; maintenance: string };
      columns: readonly string[];
      actionLabel: string;
    };
    customers: {
      filters: { all: string; individual: string; corporate: string };
      columns: readonly string[];
      actionLabel: string;
    };
    reservations: {
      filters: { all: string; pending: string; confirmed: string; active: string; completed: string };
      columns: readonly string[];
      actionLabel: string;
    };
    contracts: {
      filters: { all: string; draft: string; signed: string; closed: string };
      columns: readonly string[];
      actionLabel: string;
    };
    payments: {
      filters: { all: string; paid: string; partial: string; deposit: string; unpaid: string };
      columns: readonly string[];
      actionLabel: string;
      summaryReceived: string;
      summaryDeposits: string;
      summaryOutstanding: string;
    };
    maintenance: {
      filters: { all: string; scheduled: string; inProgress: string; completed: string };
      columns: readonly string[];
      actionLabel: string;
    };
    reports: {
      periods: { month: string; quarter: string; year: string };
      kpiUtilization: string;
      kpiRevenue: string;
      kpiAvgDuration: string;
      kpiMaintenanceCost: string;
      columns: readonly string[];
      exportLabel: string;
    };
  };
  calendar: {
    weekdays: readonly string[];
    previousMonth: string;
    nextMonth: string;
    today: string;
    viewMonth: string;
    viewList: string;
    selectedDateLabel: string;
    noScheduledEvents: string;
    legendHint: string;
  };
  assistant: {
    noticeTitle: string;
    noticeBody: string;
    promptPlaceholder: string;
    sendButton: string;
    plannedCapabilitiesTitle: string;
    plannedCapabilities: readonly {
      title: string;
      description: string;
    }[];
    disabledFeedback: string;
  };
  settings: {
    identitySectionTitle: string;
    identitySectionDesc: string;
    regionalSectionTitle: string;
    regionalSectionDesc: string;
    fields: {
      agencyName: string;
      agencyNamePlaceholder: string;
      legalName: string;
      legalNamePlaceholder: string;
      taxId: string;
      taxIdPlaceholder: string;
      taxIdHelp: string;
      email: string;
      emailPlaceholder: string;
      phone: string;
      phonePlaceholder: string;
      city: string;
      cityPlaceholder: string;
      address: string;
      addressPlaceholder: string;
      currency: string;
      timezone: string;
      defaultLanguage: string;
      vatRatePercent: string;
      vatHelp: string;
    };
    validateButton: string;
    resetButton: string;
    validationSuccessTitle: string;
    validationSuccessBody: string;
    validationErrorSummary: string;
    errors: Record<ValidationErrorCode, string>;
  };
}

const FR_DICTIONARY: Dictionary = {
  dir: 'ltr',
  localeLabel: 'FR',
  brandSubtitle: 'Gestion de location automobile',
  navGroups: {
    overview: 'Principal',
    operations: 'Opérations',
    finance: 'Finance et suivi',
    platform: 'Intelligence et agence',
  },
  modules: {
    dashboard: {
      navLabel: 'Tableau de bord',
      title: 'Tableau de bord',
      description:
        'Vue d’ensemble opérationnelle de votre agence de location. Les indicateurs resteront à zéro tant que la base de données agence ne sera pas connectée.',
      emptyTitle: 'Aucune donnée opérationnelle connectée',
      emptyDescription:
        'Les départs du jour, retours attendus et indicateurs de flotte apparaîtront automatiquement dès la connexion à Supabase.',
      plannedFeatureSummary: 'Synthèse flotte, réservations du jour et indicateurs TND en temps réel.',
    },
    vehicles: {
      navLabel: 'Véhicules',
      title: 'Véhicules',
      description:
        'Répertoire du parc automobile, immatriculations tunisiennes, catégories, tarifs journaliers en TND et disponibilités.',
      emptyTitle: 'Aucun véhicule enregistré',
      emptyDescription:
        'Votre flotte apparaîtra ici dès que le module base de données et la fiche véhicule seront activés en Phase 2.',
      plannedFeatureSummary: 'Fiches véhicules, tarification TND, kilométrage, assurances et documents.',
    },
    customers: {
      navLabel: 'Clients',
      title: 'Clients',
      description:
        'Base clients particuliers et entreprises, pièces d’identité, permis de conduire et historique des locations.',
      emptyTitle: 'Aucun client enregistré',
      emptyDescription:
        'Les dossiers clients (CIN, passeport, permis et coordonnées) seront stockés de façon isolée par agence via Supabase.',
      plannedFeatureSummary: 'Dossiers clients, permis de conduire, historique et liste de vigilance.',
    },
    reservations: {
      navLabel: 'Réservations',
      title: 'Réservations',
      description:
        'Suivi des demandes, confirmations, prises en charge et restitutions avec contrôle automatique des conflits de dates.',
      emptyTitle: 'Aucune réservation enregistrée',
      emptyDescription:
        'Les réservations créées par votre équipe s’afficheront ici avec le calcul précis des montants en TND (3 décimales).',
      plannedFeatureSummary: 'Création, détection de chevauchements, calcul tarifaire et statuts.',
    },
    calendar: {
      navLabel: 'Calendrier',
      title: 'Calendrier',
      description:
        'Planning mensuel des départs, retours et immobilisations de flotte sur le fuseau horaire Africa/Tunis.',
      emptyTitle: 'Aucun mouvement planifié',
      emptyDescription:
        'Sélectionnez une date pour consulter les mouvements prévus. Les réservations et entretiens s’afficheront ici une fois connectés.',
      plannedFeatureSummary: 'Planning visuel multi-véhicules, départs, retours et périodes de maintenance.',
    },
    contracts: {
      navLabel: 'Contrats',
      title: 'Contrats',
      description:
        'Génération et archivage des contrats de location, états des lieux départ/retour, franchises et cautions.',
      emptyTitle: 'Aucun contrat émis',
      emptyDescription:
        'Les contrats liés aux réservations confirmées, avec numérotation séquentielle par agence, seront disponibles en Phase 4.',
      plannedFeatureSummary: 'Édition de contrats PDF, état des lieux, kilométrage et gestion de caution.',
    },
    payments: {
      navLabel: 'Paiements',
      title: 'Paiements',
      description:
        'Journal des encaissements, acomptes, cautions et soldes clients exprimés en dinars tunisiens (TND).',
      emptyTitle: 'Aucun paiement enregistré',
      emptyDescription:
        'Aucun encaissement n’est présent. Les règlements espèces, carte bancaire, chèque et virement seront suivis ici avec précision au millime.',
      plannedFeatureSummary: 'Encaissements, reçus, cautions restituées et suivi des impayés en TND.',
    },
    maintenance: {
      navLabel: 'Maintenance',
      title: 'Maintenance',
      description:
        'Planification des vidanges, visites techniques, assurances, vignettes et interventions atelier.',
      emptyTitle: 'Aucune opération de maintenance',
      emptyDescription:
        'Les échéances réglementaires tunisiennes (visite technique, assurance, vignette) et réparations seront enregistrées ici.',
      plannedFeatureSummary: 'Suivi kilométrique, échéances légales, coûts atelier et alertes.',
    },
    reports: {
      navLabel: 'Rapports',
      title: 'Rapports',
      description:
        'Analyses de taux d’occupation, chiffre d’affaires encaissé, rentabilité par véhicule et charges de flotte.',
      emptyTitle: 'Aucune donnée analytique disponible',
      emptyDescription:
        'Les rapports ne présentent aucune statistique simulée. Les indicateurs seront calculés uniquement à partir des données réelles de votre agence.',
      plannedFeatureSummary: 'Rentabilité par véhicule, occupation mensuelle et exports comptables.',
    },
    assistant: {
      navLabel: 'Assistant IA',
      title: 'Assistant IA',
      description:
        'Futur copilote opérationnel pour l’analyse de flotte, l’aide à la tarification et la synthèse de gestion.',
      emptyTitle: 'Intégration Gemini prévue en phase ultérieure',
      emptyDescription:
        'Conformément au plan de développement, aucune connexion API Gemini n’est active dans la fondation Phase 1.',
      plannedFeatureSummary: 'Questions en langage naturel sur la flotte, alertes et synthèses via Gemini.',
    },
    settings: {
      navLabel: 'Paramètres',
      title: 'Paramètres de l’agence',
      description:
        'Configuration de l’identité juridique, des coordonnées et des paramètres régionaux de votre agence en Tunisie.',
      emptyTitle: 'Configuration non enregistrée',
      emptyDescription:
        'Les champs ci-dessous permettent de valider le format de votre profil agence avant la mise en place de Supabase en Phase 2.',
      plannedFeatureSummary: 'Profil agence, devise TND, fuseau Africa/Tunis, TVA et utilisateurs.',
    },
  },
  common: {
    phase1Label: 'Fondation Phase 1',
    phase1NoticeTitle: 'Module en préparation — Socle d’interface actif',
    phase1NoticeBody:
      'Aucune base de données ni authentification n’est connectée à ce stade. Aucune donnée métier simulée n’est affichée.',
    moduleNotImplemented: 'Données non connectées',
    plannedFor: 'Activation prévue',
    noDatabaseConnected: 'Base de données non connectée',
    zeroRecords: '0 enregistrement',
    searchPlaceholder: 'Rechercher…',
    resetFilters: 'Réinitialiser',
    allFilter: 'Tous',
    toggleThemeLight: 'Passer au thème clair',
    toggleThemeDark: 'Passer au thème sombre',
    openNavigation: 'Ouvrir le menu de navigation',
    closeNavigation: 'Fermer le menu de navigation',
    collapseSidebar: 'Réduire la barre latérale',
    expandSidebar: 'Déployer la barre latérale',
    languageSelectorLabel: 'Choisir la langue de l’interface',
    currencyLabel: 'Devise',
    timezoneLabel: 'Fuseau horaire',
    marketLabel: 'Marché',
    tunisia: 'Tunisie',
    workspace: 'Espace agence',
    noFilterMatch: 'Aucun résultat pour les critères sélectionnés — aucune donnée n’est encore enregistrée.',
    upcomingActionNote: 'Disponible après connexion à la base de données',
  },
  dashboard: {
    metricsHeading: 'Indicateurs de l’agence',
    metricsFootnote:
      'Valeurs réelles à zéro : aucune statistique fictive n’est générée avant la connexion à Supabase.',
    kpiFleet: 'Véhicules en flotte',
    kpiActiveRentals: 'Locations en cours',
    kpiPendingReturns: 'Retours prévus aujourd’hui',
    kpiMonthlyRevenue: 'Chiffre d’affaires du mois',
    kpiSubZero: '0 enregistré',
    kpiSubNoDb: 'En attente de base de données',
    modulesHeading: 'Architecture des modules KIRALIS',
    modulesSubheading:
      'Accédez à chaque section pour vérifier la navigation, la structure des écrans et le périmètre fonctionnel prévu.',
    openModule: 'Ouvrir',
    statusFoundation: 'Socle prêt',
    quickReadinessHeading: 'Paramètres socle actifs',
    readinessItems: [
      {
        title: 'Devise et précision monétaire',
        detail: 'Dinar tunisien (TND) formaté sur 3 décimales avec calculs en millimes entiers.',
        status: 'Actif',
      },
      {
        title: 'Localisation et fuseau horaire',
        detail: 'Interface en français par défaut (anglais et arabe préparés), fuseau Africa/Tunis.',
        status: 'Actif',
      },
      {
        title: 'Persistance Supabase et RLS',
        detail: 'Isolement multi-agences, authentification Supabase et schémas PostgreSQL.',
        status: 'Phase 2',
      },
      {
        title: 'Assistant IA Gemini',
        detail: 'Analyse métier côté serveur uniquement après connexion des données agence.',
        status: 'Phase 6',
      },
    ],
  },
  tables: {
    vehicles: {
      filters: {
        all: 'Tous',
        available: 'Disponibles',
        rented: 'En location',
        maintenance: 'En maintenance',
      },
      columns: ['Immatriculation', 'Véhicule', 'Catégorie', 'Kilométrage', 'Tarif / jour', 'Statut'],
      actionLabel: 'Nouveau véhicule',
    },
    customers: {
      filters: {
        all: 'Tous',
        individual: 'Particuliers',
        corporate: 'Entreprises',
      },
      columns: ['Client', 'Type', 'Pièce d’identité', 'Téléphone', 'Locations', 'Statut'],
      actionLabel: 'Nouveau client',
    },
    reservations: {
      filters: {
        all: 'Toutes',
        pending: 'En attente',
        confirmed: 'Confirmées',
        active: 'En cours',
        completed: 'Terminées',
      },
      columns: ['Référence', 'Client', 'Véhicule', 'Période', 'Montant estimé', 'Statut'],
      actionLabel: 'Nouvelle réservation',
    },
    contracts: {
      filters: {
        all: 'Tous',
        draft: 'Brouillons',
        signed: 'Signés',
        closed: 'Clôturés',
      },
      columns: ['N° Contrat', 'Réservation', 'Client', 'Caution', 'Total TTC', 'Statut'],
      actionLabel: 'Nouveau contrat',
    },
    payments: {
      filters: {
        all: 'Tous',
        paid: 'Encaissés',
        partial: 'Partiels',
        deposit: 'Cautions',
        unpaid: 'Impayés',
      },
      columns: ['Date', 'Référence', 'Client', 'Mode', 'Montant (TND)', 'Statut'],
      actionLabel: 'Enregistrer un paiement',
      summaryReceived: 'Encaissé sur la période',
      summaryDeposits: 'Cautions détenues',
      summaryOutstanding: 'Solde restant dû',
    },
    maintenance: {
      filters: {
        all: 'Toutes',
        scheduled: 'Planifiées',
        inProgress: 'En cours',
        completed: 'Terminées',
      },
      columns: ['Véhicule', 'Intervention', 'Échéance', 'Prestataire', 'Coût (TND)', 'Statut'],
      actionLabel: 'Planifier une intervention',
    },
    reports: {
      periods: {
        month: 'Mois en cours',
        quarter: 'Trimestre',
        year: 'Année',
      },
      kpiUtilization: 'Taux d’occupation',
      kpiRevenue: 'Revenus encaissés',
      kpiAvgDuration: 'Durée moyenne',
      kpiMaintenanceCost: 'Coûts maintenance',
      columns: ['Véhicule', 'Jours loués', 'Occupation', 'Revenus (TND)', 'Maintenance (TND)', 'Marge nette'],
      exportLabel: 'Exporter CSV',
    },
  },
  calendar: {
    weekdays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    today: 'Aujourd’hui',
    viewMonth: 'Grille mensuelle',
    viewList: 'Liste du mois',
    selectedDateLabel: 'Date sélectionnée',
    noScheduledEvents:
      'Aucun départ, retour ou entretien n’est planifié pour cette date. Les événements apparaîtront dès la connexion à la base de données.',
    legendHint: 'Fuseau horaire de référence : Africa/Tunis (UTC+1).',
  },
  assistant: {
    noticeTitle: 'Assistant IA non connecté en Phase 1',
    noticeBody:
      'Aucune clé API Gemini ni appel IA n’est exécuté pour le moment. Cet espace prépare l’interface conversationnelle qui sera reliée au serveur en phase ultérieure.',
    promptPlaceholder: 'Posez une question sur votre flotte ou vos réservations (disponible en Phase 6)…',
    sendButton: 'Indisponible',
    plannedCapabilitiesTitle: 'Capacités prévues lors de l’activation Gemini',
    plannedCapabilities: [
      {
        title: 'Disponibilité et conflits de flotte',
        description: 'Identifier les véhicules libres sur une période et repérer les rotations serrées.',
      },
      {
        title: 'Synthèse des échéances légales',
        description: 'Lister les visites techniques, assurances et entretiens approchant de leur date limite.',
      },
      {
        title: 'Analyse des encaissements TND',
        description: 'Résumer les soldes ouverts, cautions en cours et performances mensuelles par catégorie.',
      },
    ],
    disabledFeedback: 'L’envoi de requêtes IA sera activé lors de l’intégration serveur Gemini.',
  },
  settings: {
    identitySectionTitle: 'Identité de l’agence',
    identitySectionDesc:
      'Renseignez les informations administratives qui figureront sur vos futurs contrats et reçus.',
    regionalSectionTitle: 'Paramètres régionaux et fiscaux',
    regionalSectionDesc:
      'Valeurs par défaut configurées pour le marché tunisien (TND à 3 décimales, fuseau Africa/Tunis).',
    fields: {
      agencyName: 'Nom commercial de l’agence',
      agencyNamePlaceholder: 'Ex. Atlas Mobility Tunis',
      legalName: 'Raison sociale',
      legalNamePlaceholder: 'Ex. Atlas Mobility SARL',
      taxId: 'Matricule fiscal',
      taxIdPlaceholder: 'Ex. 1234567/A/M/000',
      taxIdHelp: 'Format fiscal tunisien utilisé sur les factures et contrats.',
      email: 'Adresse e-mail professionnelle',
      emailPlaceholder: 'contact@agence.tn',
      phone: 'Téléphone principal',
      phonePlaceholder: '+216 71 000 000',
      city: 'Ville / Gouvernorat',
      cityPlaceholder: 'Tunis',
      address: 'Adresse complète',
      addressPlaceholder: 'Avenue Habib Bourguiba, Tunis',
      currency: 'Devise par défaut',
      timezone: 'Fuseau horaire',
      defaultLanguage: 'Langue par défaut des documents',
      vatRatePercent: 'Taux de TVA (%)',
      vatHelp: 'Taux standard tunisien : 19 %.',
    },
    validateButton: 'Vérifier le formulaire',
    resetButton: 'Effacer',
    validationSuccessTitle: 'Format du formulaire validé localement',
    validationSuccessBody:
      'Les champs saisis sont valides. Aucune donnée n’a été enregistrée car la base de données Supabase sera connectée en Phase 2.',
    validationErrorSummary: 'Veuillez corriger les champs signalés avant de continuer.',
    errors: {
      required: 'Ce champ est obligatoire.',
      invalid_email: 'Veuillez saisir une adresse e-mail valide.',
      invalid_phone: 'Veuillez saisir un numéro de téléphone valide (8 à 20 caractères).',
      invalid_vat: 'Le taux de TVA doit être compris entre 0 et 100.',
    },
  },
};

const EN_DICTIONARY: Dictionary = {
  dir: 'ltr',
  localeLabel: 'EN',
  brandSubtitle: 'Car rental operations',
  navGroups: {
    overview: 'Overview',
    operations: 'Operations',
    finance: 'Finance & Fleet',
    platform: 'Intelligence & Agency',
  },
  modules: {
    dashboard: {
      navLabel: 'Dashboard',
      title: 'Dashboard',
      description:
        'Operational overview of your rental agency. Metrics remain at zero until the agency database is connected.',
      emptyTitle: 'No operational data connected',
      emptyDescription:
        'Daily pickups, expected returns, and fleet metrics will populate automatically once Supabase is connected.',
      plannedFeatureSummary: 'Fleet summary, daily bookings, and real-time TND indicators.',
    },
    vehicles: {
      navLabel: 'Vehicles',
      title: 'Vehicles',
      description:
        'Fleet registry, registration plates, vehicle categories, daily rates in TND, and live availability.',
      emptyTitle: 'No vehicles recorded',
      emptyDescription:
        'Your fleet records will appear here once the database and vehicle forms are enabled in Phase 2.',
      plannedFeatureSummary: 'Vehicle profiles, TND pricing, odometer logs, insurance, and documents.',
    },
    customers: {
      navLabel: 'Customers',
      title: 'Customers',
      description:
        'Individual and corporate customer directory, ID records, driver licenses, and rental history.',
      emptyTitle: 'No customers recorded',
      emptyDescription:
        'Customer profiles (ID, passport, driver license, contact details) will be isolated per agency in Supabase.',
      plannedFeatureSummary: 'Customer records, driver licenses, rental history, and verification.',
    },
    reservations: {
      navLabel: 'Reservations',
      title: 'Reservations',
      description:
        'Booking requests, confirmations, pickups, and returns with automatic date conflict checks.',
      emptyTitle: 'No reservations recorded',
      emptyDescription:
        'Bookings created by your staff will appear here with exact 3-decimal TND pricing.',
      plannedFeatureSummary: 'Booking workflow, conflict prevention, pricing rules, and status tracking.',
    },
    calendar: {
      navLabel: 'Calendar',
      title: 'Calendar',
      description:
        'Monthly schedule of pickups, returns, and maintenance holds in the Africa/Tunis timezone.',
      emptyTitle: 'No scheduled movements',
      emptyDescription:
        'Select any date to inspect planned activity. Reservations and maintenance slots will appear here once connected.',
      plannedFeatureSummary: 'Multi-vehicle visual schedule, handovers, and service windows.',
    },
    contracts: {
      navLabel: 'Contracts',
      title: 'Contracts',
      description:
        'Rental agreements, pickup/return inspection checklists, deductibles, and security deposits.',
      emptyTitle: 'No contracts issued',
      emptyDescription:
        'Contracts linked to confirmed bookings with sequential agency numbering will be available in Phase 4.',
      plannedFeatureSummary: 'PDF contract generation, vehicle check-in/out, mileage, and deposits.',
    },
    payments: {
      navLabel: 'Payments',
      title: 'Payments',
      description:
        'Ledger of payments, advances, security deposits, and customer balances in Tunisian Dinars (TND).',
      emptyTitle: 'No payments recorded',
      emptyDescription:
        'No transactions are present yet. Cash, card, check, and bank transfer entries will be tracked to the exact millime.',
      plannedFeatureSummary: 'Receipts, deposit refunds, payment methods, and overdue balance tracking.',
    },
    maintenance: {
      navLabel: 'Maintenance',
      title: 'Maintenance',
      description:
        'Scheduled oil changes, technical inspections, insurance renewals, road tax, and workshop repairs.',
      emptyTitle: 'No maintenance tasks',
      emptyDescription:
        'Regulatory deadlines (technical inspection, insurance, vignette) and workshop jobs will be tracked here.',
      plannedFeatureSummary: 'Mileage intervals, legal expirations, workshop expenses, and reminders.',
    },
    reports: {
      navLabel: 'Reports',
      title: 'Reports',
      description:
        'Fleet utilization, collected revenue, vehicle profitability, and maintenance cost analytics.',
      emptyTitle: 'No analytics available',
      emptyDescription:
        'Reports do not display fabricated metrics. Calculations will run strictly on verified agency records.',
      plannedFeatureSummary: 'Vehicle profitability, monthly utilization, and accounting exports.',
    },
    assistant: {
      navLabel: 'AI Assistant',
      title: 'AI Assistant',
      description:
        'Upcoming operational copilot for fleet analysis, pricing guidance, and agency summaries.',
      emptyTitle: 'Gemini integration planned for a later phase',
      emptyDescription:
        'As specified for Phase 1, no Gemini API integration or AI calls are active in this foundation.',
      plannedFeatureSummary: 'Natural-language queries on fleet availability, alerts, and summaries.',
    },
    settings: {
      navLabel: 'Settings',
      title: 'Agency Settings',
      description:
        'Configure your agency legal identity, contact details, and Tunisia regional defaults.',
      emptyTitle: 'Configuration not saved',
      emptyDescription:
        'Use this form to verify your agency profile structure before Supabase persistence is added in Phase 2.',
      plannedFeatureSummary: 'Agency profile, TND currency, Africa/Tunis timezone, VAT, and team.',
    },
  },
  common: {
    phase1Label: 'Phase 1 Foundation',
    phase1NoticeTitle: 'Module in preparation — UI foundation active',
    phase1NoticeBody:
      'No database or authentication is connected yet. Zero fabricated business data is displayed.',
    moduleNotImplemented: 'Data not connected',
    plannedFor: 'Scheduled for',
    noDatabaseConnected: 'Database not connected',
    zeroRecords: '0 records',
    searchPlaceholder: 'Search…',
    resetFilters: 'Reset',
    allFilter: 'All',
    toggleThemeLight: 'Switch to light theme',
    toggleThemeDark: 'Switch to dark theme',
    openNavigation: 'Open navigation menu',
    closeNavigation: 'Close navigation menu',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    languageSelectorLabel: 'Select interface language',
    currencyLabel: 'Currency',
    timezoneLabel: 'Timezone',
    marketLabel: 'Market',
    tunisia: 'Tunisia',
    workspace: 'Agency workspace',
    noFilterMatch: 'No matching results — no records are stored in the database yet.',
    upcomingActionNote: 'Available once database is connected',
  },
  dashboard: {
    metricsHeading: 'Agency indicators',
    metricsFootnote:
      'Honest zero state: no simulated statistics are generated prior to connecting Supabase.',
    kpiFleet: 'Fleet vehicles',
    kpiActiveRentals: 'Active rentals',
    kpiPendingReturns: 'Returns due today',
    kpiMonthlyRevenue: 'Monthly revenue',
    kpiSubZero: '0 recorded',
    kpiSubNoDb: 'Awaiting database',
    modulesHeading: 'KIRALIS module architecture',
    modulesSubheading:
      'Navigate to any module to inspect screen layouts, tables, empty states, and planned scope.',
    openModule: 'Open',
    statusFoundation: 'Foundation ready',
    quickReadinessHeading: 'Active foundation defaults',
    readinessItems: [
      {
        title: 'Currency & monetary precision',
        detail: 'Tunisian Dinar (TND) formatted to 3 decimal places using integer millime math.',
        status: 'Active',
      },
      {
        title: 'Localization & timezone',
        detail: 'French default with English and Arabic translations prepared, Africa/Tunis timezone.',
        status: 'Active',
      },
      {
        title: 'Supabase persistence & RLS',
        detail: 'Per-agency tenant isolation, Supabase Auth, and PostgreSQL schemas.',
        status: 'Phase 2',
      },
      {
        title: 'Gemini AI Assistant',
        detail: 'Server-side operational assistant connected after real agency data is live.',
        status: 'Phase 6',
      },
    ],
  },
  tables: {
    vehicles: {
      filters: { all: 'All', available: 'Available', rented: 'Rented', maintenance: 'Maintenance' },
      columns: ['Plate', 'Vehicle', 'Category', 'Odometer', 'Daily rate', 'Status'],
      actionLabel: 'Add vehicle',
    },
    customers: {
      filters: { all: 'All', individual: 'Individuals', corporate: 'Corporate' },
      columns: ['Customer', 'Type', 'ID / Passport', 'Phone', 'Rentals', 'Status'],
      actionLabel: 'Add customer',
    },
    reservations: {
      filters: { all: 'All', pending: 'Pending', confirmed: 'Confirmed', active: 'Active', completed: 'Completed' },
      columns: ['Reference', 'Customer', 'Vehicle', 'Dates', 'Estimated total', 'Status'],
      actionLabel: 'New reservation',
    },
    contracts: {
      filters: { all: 'All', draft: 'Drafts', signed: 'Signed', closed: 'Closed' },
      columns: ['Contract #', 'Reservation', 'Customer', 'Deposit', 'Total incl. VAT', 'Status'],
      actionLabel: 'New contract',
    },
    payments: {
      filters: { all: 'All', paid: 'Paid', partial: 'Partial', deposit: 'Deposits', unpaid: 'Unpaid' },
      columns: ['Date', 'Reference', 'Customer', 'Method', 'Amount (TND)', 'Status'],
      actionLabel: 'Record payment',
      summaryReceived: 'Collected in period',
      summaryDeposits: 'Deposits held',
      summaryOutstanding: 'Outstanding balance',
    },
    maintenance: {
      filters: { all: 'All', scheduled: 'Scheduled', inProgress: 'In progress', completed: 'Completed' },
      columns: ['Vehicle', 'Service', 'Due date', 'Provider', 'Cost (TND)', 'Status'],
      actionLabel: 'Schedule service',
    },
    reports: {
      periods: { month: 'Current month', quarter: 'Quarter', year: 'Year' },
      kpiUtilization: 'Utilization rate',
      kpiRevenue: 'Collected revenue',
      kpiAvgDuration: 'Average duration',
      kpiMaintenanceCost: 'Maintenance cost',
      columns: ['Vehicle', 'Days rented', 'Utilization', 'Revenue (TND)', 'Maintenance (TND)', 'Net margin'],
      exportLabel: 'Export CSV',
    },
  },
  calendar: {
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    today: 'Today',
    viewMonth: 'Month grid',
    viewList: 'Month list',
    selectedDateLabel: 'Selected date',
    noScheduledEvents:
      'No pickups, returns, or maintenance events are scheduled for this date. Events will appear once the database is connected.',
    legendHint: 'Reference timezone: Africa/Tunis (UTC+1).',
  },
  assistant: {
    noticeTitle: 'AI Assistant not connected in Phase 1',
    noticeBody:
      'No Gemini API key or AI calls are active yet. This screen prepares the conversational workspace for a future phase.',
    promptPlaceholder: 'Ask a question about your fleet or reservations (available in Phase 6)…',
    sendButton: 'Unavailable',
    plannedCapabilitiesTitle: 'Planned capabilities upon Gemini activation',
    plannedCapabilities: [
      {
        title: 'Fleet availability & conflict checks',
        description: 'Identify available vehicles for a date window and spot tight turnarounds.',
      },
      {
        title: 'Compliance deadline summary',
        description: 'List upcoming technical inspections, insurance renewals, and service intervals.',
      },
      {
        title: 'TND cashflow overview',
        description: 'Summarize open balances, held deposits, and monthly category performance.',
      },
    ],
    disabledFeedback: 'AI prompts will be enabled once server-side Gemini integration is added.',
  },
  settings: {
    identitySectionTitle: 'Agency identity',
    identitySectionDesc:
      'Legal and contact details that will appear on future rental contracts and payment receipts.',
    regionalSectionTitle: 'Regional & tax defaults',
    regionalSectionDesc:
      'Defaults preconfigured for Tunisia (3-decimal TND currency, Africa/Tunis timezone).',
    fields: {
      agencyName: 'Agency trading name',
      agencyNamePlaceholder: 'e.g. Atlas Mobility Tunis',
      legalName: 'Legal entity name',
      legalNamePlaceholder: 'e.g. Atlas Mobility SARL',
      taxId: 'Tax registration ID',
      taxIdPlaceholder: 'e.g. 1234567/A/M/000',
      taxIdHelp: 'Tunisian Matricule Fiscal shown on invoices and contracts.',
      email: 'Business email',
      emailPlaceholder: 'contact@agency.tn',
      phone: 'Primary phone',
      phonePlaceholder: '+216 71 000 000',
      city: 'City / Governorate',
      cityPlaceholder: 'Tunis',
      address: 'Street address',
      addressPlaceholder: 'Avenue Habib Bourguiba, Tunis',
      currency: 'Default currency',
      timezone: 'Timezone',
      defaultLanguage: 'Default document language',
      vatRatePercent: 'VAT rate (%)',
      vatHelp: 'Standard Tunisian VAT rate: 19%.',
    },
    validateButton: 'Validate form',
    resetButton: 'Clear',
    validationSuccessTitle: 'Form validated locally',
    validationSuccessBody:
      'All entered fields are valid. Nothing was persisted because Supabase database storage will be wired in Phase 2.',
    validationErrorSummary: 'Please fix the highlighted fields before continuing.',
    errors: {
      required: 'This field is required.',
      invalid_email: 'Please enter a valid email address.',
      invalid_phone: 'Please enter a valid phone number (8 to 20 characters).',
      invalid_vat: 'VAT rate must be between 0 and 100.',
    },
  },
};

const AR_DICTIONARY: Dictionary = {
  dir: 'rtl',
  localeLabel: 'AR',
  brandSubtitle: 'إدارة وكالات كراء السيارات',
  navGroups: {
    overview: 'الرئيسية',
    operations: 'العمليات',
    finance: 'المالية والمتابعة',
    platform: 'الذكاء والوكالة',
  },
  modules: {
    dashboard: {
      navLabel: 'لوحة القيادة',
      title: 'لوحة القيادة',
      description:
        'نظرة تشغيلية شاملة لوكالة كراء السيارات. تبقى المؤشرات عند الصفر إلى حين ربط قاعدة البيانات.',
      emptyTitle: 'لا توجد بيانات تشغيلية متصلة',
      emptyDescription:
        'ستظهر عمليات التسليم والاسترجاع ومؤشرات الأسطول تلقائياً بعد ربط قاعدة بيانات Supabase.',
      plannedFeatureSummary: 'ملخص الأسطول والحجوزات اليومية والمؤشرات المالية بالدينار التونسي.',
    },
    vehicles: {
      navLabel: 'السيارات',
      title: 'السيارات',
      description:
        'سجل الأسطول وأرقام التسجيل التونسية والفئات والتعريفات اليومية بالدينار التونسي وحالة التوفر.',
      emptyTitle: 'لا توجد سيارات مسجلة',
      emptyDescription:
        'ستظهر سيارات الوكالة هنا فور تفعيل قاعدة البيانات ونموذج إضافة السيارات في المرحلة 2.',
      plannedFeatureSummary: 'بطاقات السيارات، التسعير بالدينار التونسي، العداد والوثائق.',
    },
    customers: {
      navLabel: 'الحرفاء',
      title: 'الحرفاء',
      description:
        'دليل الحرفاء الأفراد والشركات ووثائق الهوية ورخص السياقة وسجل الكراء.',
      emptyTitle: 'لا يوجد حرفاء مسجلون',
      emptyDescription:
        'سيتم حفظ ملفات الحرفاء بشكل معزول لكل وكالة عبر Supabase.',
      plannedFeatureSummary: 'ملفات الحرفاء، رخص السياقة، السجل والمتابعة.',
    },
    reservations: {
      navLabel: 'الحجوزات',
      title: 'الحجوزات',
      description:
        'متابعة الطلبات والتأكيدات ومواعيد التسليم والاسترجاع مع منع تضارب التواريخ.',
      emptyTitle: 'لا توجد حجوزات مسجلة',
      emptyDescription:
        'ستظهر الحجوزات هنا مع حساب دقيق للمبالغ بالدينار التونسي (3 أرقام بعد الفاصلة).',
      plannedFeatureSummary: 'إنشاء الحجوزات، التحقق من التوفر، التسعير وحالات الحجز.',
    },
    calendar: {
      navLabel: 'الرزنامة',
      title: 'الرزنامة',
      description:
        'الجدول الشهري لعمليات التسليم والاسترجاع والصيانة بتوقيت تونس (Africa/Tunis).',
      emptyTitle: 'لا توجد مواعيد مجدولة',
      emptyDescription:
        'اختر أي تاريخ للاطلاع على المواعيد. ستظهر الحجوزات والصيانة هنا بعد ربط قاعدة البيانات.',
      plannedFeatureSummary: 'جدول زمني متعدد السيارات للتسليم والاسترجاع والصيانة.',
    },
    contracts: {
      navLabel: 'العقود',
      title: 'العقود',
      description:
        'إعداد وأرشفة عقود الكراء ومعاينة السيارة عند التسليم والاسترجاع ومبالغ الضمان.',
      emptyTitle: 'لا توجد عقود صادرة',
      emptyDescription:
        'ستتوفر العقود المرتبطة بالحجوزات المؤكدة بترقيم تسلسلي لكل وكالة في المرحلة 4.',
      plannedFeatureSummary: 'إصدار عقود PDF ومعاينة السيارة ومتابعة الضمان.',
    },
    payments: {
      navLabel: 'المدفوعات',
      title: 'المدفوعات',
      description:
        'سجل المقابيض والتسبقات ومبالغ الضمان والأرصدة المستحقة بالدينار التونسي (TND).',
      emptyTitle: 'لا توجد مدفوعات مسجلة',
      emptyDescription:
        'لا توجد عمليات مالية حالياً. سيتم تتبع الدفع نقداً وبالبطاقة والشيك والتحويل بدقة المليم.',
      plannedFeatureSummary: 'المقابيض والإيصالات واسترجاع الضمان ومتابعة المستحقات.',
    },
    maintenance: {
      navLabel: 'الصيانة',
      title: 'الصيانة',
      description:
        'جدولة تغيير الزيت والفحص الفني والتأمين ومعلوم الجولان وإصلاحات الورشة.',
      emptyTitle: 'لا توجد عمليات صيانة',
      emptyDescription:
        'سيتم تسجيل المواعيد القانونية التونسية (الفحص الفني، التأمين، معلوم الجولان) وأعمال الصيانة هنا.',
      plannedFeatureSummary: 'المتابعة الكيلومترية والمواعيد القانونية وتكاليف الصيانة.',
    },
    reports: {
      navLabel: 'التقارير',
      title: 'التقارير',
      description:
        'تحليل نسبة الاستغلال والمداخيل المحصلة ومردودية كل سيارة وتكاليف الأسطول.',
      emptyTitle: 'لا توجد بيانات تحليلية متاحة',
      emptyDescription:
        'لا تعرض التقارير أي أرقام وهمية. ستُحسب المؤشرات حصرياً من بيانات الوكالة الفعلية.',
      plannedFeatureSummary: 'مردودية السيارات ونسبة الاستغلال الشهري وتصدير البيانات.',
    },
    assistant: {
      navLabel: 'المساعد الذكي',
      title: 'المساعد الذكي',
      description:
        'مساعد تشغيلي مستقبلي لتحليل الأسطول وتقديم ملخصات الإدارة ودعم التسعير.',
      emptyTitle: 'ربط Gemini مبرمج في مرحلة لاحقة',
      emptyDescription:
        'لا يوجد أي اتصال بواجهة Gemini في المرحلة الأولى من تأسيس التطبيق.',
      plannedFeatureSummary: 'استفسارات باللغة الطبيعية حول الأسطول والتنبيهات والملخصات.',
    },
    settings: {
      navLabel: 'الإعدادات',
      title: 'إعدادات الوكالة',
      description:
        'إعداد الهوية القانونية وبيانات الاتصال والإعدادات الإقليمية لوكالتك في تونس.',
      emptyTitle: 'الإعدادات غير محفوظة',
      emptyDescription:
        'يمكنك التحقق من صيغة بيانات الوكالة هنا قبل ربط الحفظ في Supabase خلال المرحلة 2.',
      plannedFeatureSummary: 'ملف الوكالة، الدينار التونسي، توقيت تونس والضريبة.',
    },
  },
  common: {
    phase1Label: 'المرحلة 1 — الأساس',
    phase1NoticeTitle: 'وحدة قيد الإعداد — هيكل الواجهة جاهز',
    phase1NoticeBody:
      'لم يتم ربط قاعدة البيانات أو المصادقة بعد. لا يتم عرض أي بيانات تجارية وهمية.',
    moduleNotImplemented: 'البيانات غير متصلة',
    plannedFor: 'مبرمج في',
    noDatabaseConnected: 'قاعدة البيانات غير متصلة',
    zeroRecords: '0 سجل',
    searchPlaceholder: 'بحث…',
    resetFilters: 'إعادة ضبط',
    allFilter: 'الكل',
    toggleThemeLight: 'التبديل إلى الوضع الفاتح',
    toggleThemeDark: 'التبديل إلى الوضع الداكن',
    openNavigation: 'فتح قائمة التنقل',
    closeNavigation: 'إغلاق قائمة التنقل',
    collapseSidebar: 'طي الشريط الجانبي',
    expandSidebar: 'توسيع الشريط الجانبي',
    languageSelectorLabel: 'اختيار لغة الواجهة',
    currencyLabel: 'العملة',
    timezoneLabel: 'التوقيت',
    marketLabel: 'السوق',
    tunisia: 'تونس',
    workspace: 'مساحة الوكالة',
    noFilterMatch: 'لا توجد نتائج مطابقة — لم يتم تسجيل أي بيانات بعد.',
    upcomingActionNote: 'متاح بعد ربط قاعدة البيانات',
  },
  dashboard: {
    metricsHeading: 'مؤشرات الوكالة',
    metricsFootnote:
      'قيم صفرية حقيقية: لا يتم توليد أي إحصائيات وهمية قبل ربط Supabase.',
    kpiFleet: 'سيارات الأسطول',
    kpiActiveRentals: 'عمليات الكراء الجارية',
    kpiPendingReturns: 'الاسترجاعات المتوقعة اليوم',
    kpiMonthlyRevenue: 'مداخيل الشهر',
    kpiSubZero: '0 مسجل',
    kpiSubNoDb: 'في انتظار قاعدة البيانات',
    modulesHeading: 'هيكلة وحدات KIRALIS',
    modulesSubheading:
      'تنقل بين الوحدات لمعاينة بنية الشاشات والجداول والحالات الفارغة.',
    openModule: 'فتح',
    statusFoundation: 'الهيكل جاهز',
    quickReadinessHeading: 'الإعدادات الأساسية المفعلة',
    readinessItems: [
      {
        title: 'العملة والدقة الحسابية',
        detail: 'الدينار التونسي (TND) بثلاثة أرقام بعد الفاصلة وحسابات دقيقة بالمليم.',
        status: 'مفعل',
      },
      {
        title: 'اللغة والمنطقة الزمنية',
        detail: 'الفرنسية كلغة افتراضية مع جاهزية الإنجليزية والعربية وتوقيت Africa/Tunis.',
        status: 'مفعل',
      },
      {
        title: 'قاعدة بيانات Supabase وعزل الوكالات',
        detail: 'حماية الصفوف RLS ومصادقة Supabase وجداول PostgreSQL.',
        status: 'المرحلة 2',
      },
      {
        title: 'مساعد Gemini الذكي',
        detail: 'مساعد تشغيلي على الخادم بعد توفر بيانات الوكالة الفعلية.',
        status: 'المرحلة 6',
      },
    ],
  },
  tables: {
    vehicles: {
      filters: { all: 'الكل', available: 'متوفرة', rented: 'في الكراء', maintenance: 'في الصيانة' },
      columns: ['رقم التسجيل', 'السيارة', 'الفئة', 'العداد', 'السعر / يوم', 'الحالة'],
      actionLabel: 'إضافة سيارة',
    },
    customers: {
      filters: { all: 'الكل', individual: 'أفراد', corporate: 'شركات' },
      columns: ['الحريف', 'النوع', 'وثيقة الهوية', 'الهاتف', 'عدد الكراءات', 'الحالة'],
      actionLabel: 'إضافة حريف',
    },
    reservations: {
      filters: { all: 'الكل', pending: 'قيد الانتظار', confirmed: 'مؤكدة', active: 'جارية', completed: 'مكتملة' },
      columns: ['المرجع', 'الحريف', 'السيارة', 'الفترة', 'المبلغ التقديري', 'الحالة'],
      actionLabel: 'حجز جديد',
    },
    contracts: {
      filters: { all: 'الكل', draft: 'مسودات', signed: 'موقعة', closed: 'مغلقة' },
      columns: ['رقم العقد', 'الحجز', 'الحريف', 'الضمان', 'المجموع TTC', 'الحالة'],
      actionLabel: 'عقد جديد',
    },
    payments: {
      filters: { all: 'الكل', paid: 'محصلة', partial: 'جزئية', deposit: 'ضمانات', unpaid: 'غير مسددة' },
      columns: ['التاريخ', 'المرجع', 'الحريف', 'الطريقة', 'المبلغ (TND)', 'الحالة'],
      actionLabel: 'تسجيل دفعة',
      summaryReceived: 'المحصل خلال الفترة',
      summaryDeposits: 'الضمانات المحتفظ بها',
      summaryOutstanding: 'الرصيد المتبقي',
    },
    maintenance: {
      filters: { all: 'الكل', scheduled: 'مجدولة', inProgress: 'جارية', completed: 'منتهية' },
      columns: ['السيارة', 'نوع التدخل', 'تاريخ الاستحقاق', 'المزود', 'التكلفة (TND)', 'الحالة'],
      actionLabel: 'جدولة صيانة',
    },
    reports: {
      periods: { month: 'الشهر الحالي', quarter: 'الثلاثي', year: 'السنة' },
      kpiUtilization: 'نسبة الاستغلال',
      kpiRevenue: 'المداخيل المحصلة',
      kpiAvgDuration: 'متوسط المدة',
      kpiMaintenanceCost: 'تكاليف الصيانة',
      columns: ['السيارة', 'أيام الكراء', 'الاستغلال', 'المداخيل (TND)', 'الصيانة (TND)', 'الهامش الصافي'],
      exportLabel: 'تصدير CSV',
    },
  },
  calendar: {
    weekdays: ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد'],
    previousMonth: 'الشهر السابق',
    nextMonth: 'الشهر التالي',
    today: 'اليوم',
    viewMonth: 'الشبكة الشهرية',
    viewList: 'قائمة الشهر',
    selectedDateLabel: 'التاريخ المحدد',
    noScheduledEvents:
      'لا توجد عمليات تسليم أو استرجاع أو صيانة مجدولة في هذا التاريخ. ستظهر المواعيد بعد ربط قاعدة البيانات.',
    legendHint: 'المنطقة الزمنية المرجعية: Africa/Tunis (UTC+1).',
  },
  assistant: {
    noticeTitle: 'المساعد الذكي غير متصل في المرحلة 1',
    noticeBody:
      'لا يتم تشغيل أي مفتاح Gemini أو طلبات ذكاء اصطناعي حالياً. تُعد هذه الصفحة مساحة المحادثة للمرحلة القادمة.',
    promptPlaceholder: 'اطرح سؤالاً حول أسطولك أو حجوزاتك (متاح في المرحلة 6)…',
    sendButton: 'غير متاح',
    plannedCapabilitiesTitle: 'القدرات المبرمجة عند تفعيل Gemini',
    plannedCapabilities: [
      {
        title: 'توفر الأسطول وتعارض المواعيد',
        description: 'تحديد السيارات المتاحة خلال فترة معينة وكشف التداخلات.',
      },
      {
        title: 'ملخص المواعيد القانونية',
        description: 'جرد مواعيد الفحص الفني والتأمين والصيانة القريبة.',
      },
      {
        title: 'تحليل المقابيض بالدينار التونسي',
        description: 'تلخيص الأرصدة المفتوحة والضمانات والأداء الشهري حسب الفئة.',
      },
    ],
    disabledFeedback: 'سيتم تفعيل إرسال الطلبات عند دمج Gemini على الخادم.',
  },
  settings: {
    identitySectionTitle: 'هوية الوكالة',
    identitySectionDesc:
      'المعلومات الإدارية والقانونية التي ستظهر في العقود والإيصالات المستقبلية.',
    regionalSectionTitle: 'الإعدادات الإقليمية والجبائية',
    regionalSectionDesc:
      'إعدادات افتراضية مضبوطة للسوق التونسي (الدينار التونسي بـ 3 أرقام وتوقيت تونس).',
    fields: {
      agencyName: 'الاسم التجاري للوكالة',
      agencyNamePlaceholder: 'مثال: أطلس موبيليتي تونس',
      legalName: 'الاسم القانوني',
      legalNamePlaceholder: 'مثال: أطلس موبيليتي ش.ذ.م.م',
      taxId: 'المعرف الجبائي',
      taxIdPlaceholder: 'مثال: 1234567/A/M/000',
      taxIdHelp: 'المعرف الجبائي التونسي المعتمد في الفواتير والعقود.',
      email: 'البريد الإلكتروني المهني',
      emailPlaceholder: 'contact@agency.tn',
      phone: 'الهاتف الرئيسي',
      phonePlaceholder: '+216 71 000 000',
      city: 'المدينة / الولاية',
      cityPlaceholder: 'تونس',
      address: 'العنوان الكامل',
      addressPlaceholder: 'شارع الحبيب بورقيبة، تونس',
      currency: 'العملة الافتراضية',
      timezone: 'المنطقة الزمنية',
      defaultLanguage: 'اللغة الافتراضية للوثائق',
      vatRatePercent: 'نسبة الأداء على القيمة المضافة (%)',
      vatHelp: 'النسبة الاعتيادية في تونس: 19%.',
    },
    validateButton: 'التحقق من النموذج',
    resetButton: 'مسح',
    validationSuccessTitle: 'تم التحقق من صيغة النموذج محلياً',
    validationSuccessBody:
      'جميع الحقول المدخلة صالحة. لم يتم حفظ أي بيانات لأن قاعدة بيانات Supabase ستُربط في المرحلة 2.',
    validationErrorSummary: 'يرجى تصحيح الحقول المحددة قبل المتابعة.',
    errors: {
      required: 'هذا الحقل مطلوب.',
      invalid_email: 'يرجى إدخال بريد إلكتروني صالح.',
      invalid_phone: 'يرجى إدخال رقم هاتف صالح (من 8 إلى 20 حرفاً).',
      invalid_vat: 'يجب أن تكون النسبة بين 0 و 100.',
    },
  },
};

export const DICTIONARIES: Record<SupportedLocale, Dictionary> = {
  fr: FR_DICTIONARY,
  en: EN_DICTIONARY,
  ar: AR_DICTIONARY,
};

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['fr', 'en', 'ar'];

export function getDictionary(locale: SupportedLocale): Dictionary {
  return DICTIONARIES[locale] ?? FR_DICTIONARY;
}
