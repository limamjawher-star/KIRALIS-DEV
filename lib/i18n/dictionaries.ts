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
  customersDirectory: {
    title: string;
    description: string;
    refreshLabel: string;
    refreshAriaLabel: string;
    refreshingLabel: string;
    retryLabel: string;
    loadErrorFallback: string;
    networkError: string;
    roles: Record<'owner' | 'manager' | 'agent', string>;
    stats: {
      totalLabel: string;
      totalNote: string;
      individualLabel: string;
      individualNote: string;
      corporateLabel: string;
      corporateNote: string;
      withEmailLabel: string;
      withEmailNote: string;
    };
    searchPlaceholder: string;
    searchAriaLabel: string;
    typeFilterAriaLabel: string;
    typeFilters: {
      all: string;
      individual: string;
      corporate: string;
    };
    typeBadges: {
      individual: string;
      corporate: string;
    };
    sortAriaLabel: string;
    sortPrefix: string;
    sortOptions: {
      newest: string;
      oldest: string;
      name_asc: string;
      name_desc: string;
    };
    resetFiltersLabel: string;
    tableAriaLabel: string;
    columns: {
      customer: string;
      type: string;
      phone: string;
      email: string;
      city: string;
      createdAt: string;
    };
    emptyAgencyTitle: string;
    emptyAgencyDescription: string;
    emptyFilterTitle: string;
    emptyFilterDescription: string;
    notProvided: string;
    loadingLabel: string;
    addButtonLabel: string;
    addFirstButtonLabel: string;
    createSuccessBanner: string;
    dismissBannerLabel: string;
    addModal: {
      title: string;
      subtitle: string;
      closeAriaLabel: string;
      sectionIdentity: string;
      sectionContact: string;
      sectionAddress: string;
      sectionNotes: string;
      customerTypeLabel: string;
      fullNameLabel: string;
      fullNamePlaceholder: string;
      companyNameLabel: string;
      companyNamePlaceholder: string;
      phoneLabel: string;
      phonePlaceholder: string;
      phoneHelper: string;
      emailLabel: string;
      emailPlaceholder: string;
      addressLabel: string;
      addressPlaceholder: string;
      cityLabel: string;
      cityPlaceholder: string;
      countryLabel: string;
      notesLabel: string;
      notesPlaceholder: string;
      cancelLabel: string;
      submitLabel: string;
      submittingLabel: string;
      validationSummaryError: string;
    };
    detailDrawer: {
      kicker: string;
      loadingTitle: string;
      loadingAriaLabel: string;
      errorTitle: string;
      closeAriaLabel: string;
      closeLabel: string;
      retryLabel: string;
      openDetailAriaPrefix: string;
      sectionIdentity: string;
      sectionContact: string;
      sectionAddress: string;
      sectionNotes: string;
      sectionTimestamps: string;
      customerTypeLabel: string;
      fullNameLabel: string;
      companyNameLabel: string;
      phoneLabel: string;
      emailLabel: string;
      addressLabel: string;
      cityLabel: string;
      countryLabel: string;
      notesLabel: string;
      noNotesLabel: string;
      createdAtLabel: string;
      updatedAtLabel: string;
      editButtonLabel: string;
      editTitle: string;
      editSubtitle: string;
      saveLabel: string;
      savingLabel: string;
      cancelLabel: string;
      noChangesMessage: string;
      updateSuccessBanner: string;
      drivers: {
        sectionTitle: string;
        refreshLabel: string;
        refreshAriaLabel: string;
        loadingLabel: string;
        loadingAriaLabel: string;
        errorTitle: string;
        retryLabel: string;
        emptyTitle: string;
        emptyDescription: string;
        driverCountSingular: string;
        driverCountPlural: string;
        statusActive: string;
        statusInactive: string;
        issuingCountryLabel: string;
        licenceCategoryLabel: string;
        licenceExpiresOnLabel: string;
        verificationStatusLabel: string;
        eligibilityLabel: string;
        warningsLabel: string;
        verificationNotesLabel: string;
        legalNotice: string;
        verificationStatuses: {
          unverified: string;
          pending: string;
          verified: string;
          rejected: string;
        };
        eligibilityStatuses: {
          blocked: string;
          attention_required: string;
          checks_passed_manual_review_required: string;
        };
        flagMessages: {
          driver_inactive: string;
          licence_expiry_missing: string;
          licence_expired: string;
          licence_expires_during_rental: string;
          licence_expiring_soon: string;
          verification_unverified: string;
          verification_pending: string;
          verification_rejected: string;
          licence_category_missing: string;
          licence_category_mismatch: string;
          issuing_country_missing: string;
          foreign_licence_manual_check: string;
        };
        addForm: {
          addButtonLabel: string;
          title: string;
          subtitle: string;
          fullNameLabel: string;
          fullNamePlaceholder: string;
          issuingCountryLabel: string;
          issuingCountryEmptyOption: string;
          licenceCategoryLabel: string;
          licenceCategoryEmptyOption: string;
          licenceExpiresOnLabel: string;
          licenceExpiresOnHelper: string;
          cancelLabel: string;
          submitLabel: string;
          submittingLabel: string;
          createSuccessBanner: string;
          dismissBannerLabel: string;
        };
        editForm: {
          editButtonLabel: string;
          editButtonAriaPrefix: string;
          title: string;
          subtitle: string;
          cancelLabel: string;
          saveLabel: string;
          savingLabel: string;
          noChangesMessage: string;
          verifiedLicenceChangeWarning: string;
          updateSuccessBanner: string;
          updateSuccessVerifiedReviewBanner: string;
        };
        verificationForm: {
          buttonLabel: string;
          buttonAriaPrefix: string;
          title: string;
          manualReviewNotice: string;
          statusLabel: string;
          notesLabel: string;
          notesPlaceholder: string;
          notesHelper: string;
          clearNotesLabel: string;
          cancelLabel: string;
          saveLabel: string;
          savingLabel: string;
          noChangesMessage: string;
          updateSuccessBanner: string;
        };
        activation: {
          deactivateButtonLabel: string;
          reactivateButtonLabel: string;
          deactivateAriaPrefix: string;
          reactivateAriaPrefix: string;
          confirmDeactivateTitle: string;
          confirmDeactivateBody: string;
          confirmDeactivateButton: string;
          cancelLabel: string;
          updatingLabel: string;
          deactivatedSuccessBanner: string;
          reactivatedSuccessBanner: string;
        };
      };
    };
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
        'Vue d’ensemble opérationnelle de votre agence de location connectée à Supabase PostgreSQL.',
      emptyTitle: 'Aucun enregistrement opérationnel',
      emptyDescription:
        'Les véhicules, clients et réservations de votre agence apparaîtront ici au fur et à mesure de leur enregistrement.',
      plannedFeatureSummary: 'Synthèse flotte, réservations du jour et indicateurs TND en temps réel.',
    },
    vehicles: {
      navLabel: 'Véhicules',
      title: 'Véhicules',
      description:
        'Répertoire du parc automobile, immatriculations tunisiennes, catégories, tarifs journaliers en TND et disponibilités.',
      emptyTitle: 'Aucun véhicule enregistré',
      emptyDescription:
        'Votre flotte apparaîtra ici dès l’activation du module de gestion des véhicules en Phase 5.',
      plannedFeatureSummary: 'Fiches véhicules, tarification TND, kilométrage, assurances et documents.',
    },
    customers: {
      navLabel: 'Clients',
      title: 'Clients',
      description:
        'Répertoire des clients particuliers et entreprises de votre agence, synchronisé avec Supabase PostgreSQL.',
      emptyTitle: 'Aucun client enregistré',
      emptyDescription:
        'Aucun client n’est encore enregistré pour cette agence dans Supabase.',
      plannedFeatureSummary: 'Répertoire clients, recherche multi-critères et filtrage par type.',
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
        'Planning réel des départs, retours et locations en cours, dans le fuseau horaire de votre agence.',
      emptyTitle: 'Aucun mouvement planifié',
      emptyDescription:
        'Sélectionnez une date pour consulter les réservations et mouvements de votre agence.',
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
        'Conformément au plan de développement, aucune connexion API Gemini n’est encore activée.',
      plannedFeatureSummary: 'Questions en langage naturel sur la flotte, alertes et synthèses via Gemini.',
    },
    settings: {
      navLabel: 'Paramètres',
      title: 'Paramètres de l’agence',
      description:
        'Configuration de l’identité juridique, des coordonnées et des paramètres régionaux de votre agence en Tunisie.',
      emptyTitle: 'Paramètres de l’agence chargés',
      emptyDescription:
        'Les informations affichées proviennent directement de votre fiche agence enregistrée dans Supabase PostgreSQL.',
      plannedFeatureSummary: 'Profil agence, devise TND, fuseau Africa/Tunis, TVA et utilisateurs.',
    },
  },
  common: {
    phase1Label: 'KIRALIS · Espace agence',
    phase1NoticeTitle: 'Module métier en préparation',
    phase1NoticeBody:
      'Votre compte Supabase et votre agence sont connectés. Les opérations de ce module seront activées dans une phase ultérieure ; aucune donnée métier simulée n’est affichée.',
    moduleNotImplemented: 'Module à venir',
    plannedFor: 'Activation prévue',
    noDatabaseConnected: '0 enregistrement',
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
    upcomingActionNote: 'Disponible lors de l’activation de ce module',
  },
  dashboard: {
    metricsHeading: 'Indicateurs de l’agence',
    metricsFootnote:
      'Valeurs réelles depuis Supabase : 0 affiché lorsqu’aucun enregistrement n’existe encore.',
    kpiFleet: 'Véhicules en flotte',
    kpiActiveRentals: 'Locations en cours',
    kpiPendingReturns: 'Retours prévus aujourd’hui',
    kpiMonthlyRevenue: 'Chiffre d’affaires du mois',
    kpiSubZero: '0 enregistré',
    kpiSubNoDb: '0 enregistré',
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
        status: 'Actif',
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
      'Aucun départ ni retour prévu pour cette date.',
    legendHint: 'Fuseau horaire de référence : Africa/Tunis (UTC+1).',
  },
  assistant: {
    noticeTitle: 'Assistant IA en préparation',
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
    validationSuccessTitle: 'Format du formulaire validé',
    validationSuccessBody:
      'Les champs saisis respectent le format attendu pour votre profil agence.',
    validationErrorSummary: 'Veuillez corriger les champs signalés avant de continuer.',
    errors: {
      required: 'Ce champ est obligatoire.',
      invalid_email: 'Veuillez saisir une adresse e-mail valide.',
      invalid_phone: 'Veuillez saisir un numéro de téléphone valide (8 à 20 caractères).',
      invalid_vat: 'Le taux de TVA doit être compris entre 0 et 100.',
    },
  },
  customersDirectory: {
    title: 'Clients',
    description:
      'Consultez et filtrez le répertoire des clients particuliers et entreprises enregistrés dans votre agence.',
    refreshLabel: 'Actualiser',
    refreshAriaLabel: 'Actualiser la liste des clients',
    refreshingLabel: 'Actualisation…',
    retryLabel: 'Réessayer',
    loadErrorFallback:
      'Impossible d’actualiser le répertoire clients depuis Supabase.',
    networkError: 'Erreur réseau lors du chargement des clients.',
    roles: {
      owner: 'Propriétaire',
      manager: 'Gestionnaire',
      agent: 'Agent',
    },
    stats: {
      totalLabel: 'Total clients',
      totalNote: 'Clients enregistrés dans votre agence',
      individualLabel: 'Particuliers',
      individualNote: 'Comptes individuels',
      corporateLabel: 'Entreprises',
      corporateNote: 'Comptes sociétés',
      withEmailLabel: 'Avec e-mail',
      withEmailNote: 'Coordonnées e-mail renseignées',
    },
    searchPlaceholder: 'Rechercher par nom, entreprise, e-mail ou téléphone…',
    searchAriaLabel: 'Rechercher dans le répertoire clients',
    typeFilterAriaLabel: 'Filtrer par type de client',
    typeFilters: {
      all: 'Tous',
      individual: 'Particuliers',
      corporate: 'Entreprises',
    },
    typeBadges: {
      individual: 'Particulier',
      corporate: 'Entreprise',
    },
    sortAriaLabel: 'Trier les clients',
    sortPrefix: 'Tri',
    sortOptions: {
      newest: 'Plus récents',
      oldest: 'Plus anciens',
      name_asc: 'Nom (A → Z)',
      name_desc: 'Nom (Z → A)',
    },
    resetFiltersLabel: 'Réinitialiser',
    tableAriaLabel: 'Répertoire des clients de l’agence',
    columns: {
      customer: 'Client',
      type: 'Type',
      phone: 'Téléphone',
      email: 'E-mail',
      city: 'Ville',
      createdAt: 'Créé le',
    },
    emptyAgencyTitle: 'Aucun client enregistré dans votre agence',
    emptyAgencyDescription:
      'Votre agence ne compte encore aucun client dans Supabase. Les clients enregistrés apparaîtront automatiquement dans ce répertoire.',
    emptyFilterTitle: 'Aucun client ne correspond à votre recherche',
    emptyFilterDescription:
      'Modifiez vos termes de recherche ou réinitialisez les filtres actifs pour afficher l’ensemble du répertoire.',
    notProvided: 'Non renseigné',
    loadingLabel: 'Chargement du répertoire clients…',
    addButtonLabel: 'Ajouter un client',
    addFirstButtonLabel: 'Ajouter un premier client',
    createSuccessBanner: 'Client enregistré avec succès dans le répertoire.',
    dismissBannerLabel: 'Fermer',
    addModal: {
      title: 'Ajouter un client',
      subtitle: 'Enregistrez un client particulier ou entreprise dans votre agence.',
      closeAriaLabel: 'Fermer la fenêtre',
      sectionIdentity: 'Identité',
      sectionContact: 'Coordonnées',
      sectionAddress: 'Adresse',
      sectionNotes: 'Notes internes',
      customerTypeLabel: 'Type de client',
      fullNameLabel: 'Nom complet',
      fullNamePlaceholder: 'Ex. Sami Ben Ali',
      companyNameLabel: 'Raison sociale',
      companyNamePlaceholder: 'Ex. Atlas Mobility SARL',
      phoneLabel: 'Téléphone',
      phonePlaceholder: '+216 22 123 456',
      phoneHelper: 'Format international recommandé (ex. +216 22 123 456).',
      emailLabel: 'E-mail',
      emailPlaceholder: 'client@exemple.tn',
      addressLabel: 'Adresse',
      addressPlaceholder: 'Ex. 12 Avenue Habib Bourguiba',
      cityLabel: 'Ville',
      cityPlaceholder: 'Ex. Tunis',
      countryLabel: 'Pays',
      notesLabel: 'Notes internes',
      notesPlaceholder: 'Informations utiles pour votre équipe (facultatif)…',
      cancelLabel: 'Annuler',
      submitLabel: 'Enregistrer le client',
      submittingLabel: 'Enregistrement…',
      validationSummaryError: 'Veuillez corriger les champs indiqués ci-dessous.',
    },
    detailDrawer: {
      kicker: 'Fiche client',
      loadingTitle: 'Chargement de la fiche client…',
      loadingAriaLabel: 'Chargement des détails du client',
      errorTitle: 'Impossible d’afficher cette fiche client',
      closeAriaLabel: 'Fermer la fiche client',
      closeLabel: 'Fermer',
      retryLabel: 'Réessayer',
      openDetailAriaPrefix: 'Consulter la fiche de',
      sectionIdentity: 'Identité',
      sectionContact: 'Coordonnées',
      sectionAddress: 'Adresse et pays',
      sectionNotes: 'Notes internes',
      sectionTimestamps: 'Historique de la fiche',
      customerTypeLabel: 'Type de client',
      fullNameLabel: 'Nom complet',
      companyNameLabel: 'Raison sociale',
      phoneLabel: 'Téléphone',
      emailLabel: 'E-mail',
      addressLabel: 'Adresse',
      cityLabel: 'Ville',
      countryLabel: 'Pays',
      notesLabel: 'Notes internes',
      noNotesLabel: 'Aucune note interne enregistrée.',
      createdAtLabel: 'Date de création',
      updatedAtLabel: 'Dernière mise à jour',
      editButtonLabel: 'Modifier',
      editTitle: 'Modifier le client',
      editSubtitle: 'Mettez à jour les informations modifiables de cette fiche client.',
      saveLabel: 'Enregistrer les modifications',
      savingLabel: 'Enregistrement…',
      cancelLabel: 'Annuler',
      noChangesMessage: 'Aucune modification à enregistrer.',
      updateSuccessBanner: 'Fiche client mise à jour avec succès.',
      drivers: {
        sectionTitle: 'Conducteurs autorisés',
        refreshLabel: 'Actualiser',
        refreshAriaLabel: 'Actualiser les conducteurs autorisés',
        loadingLabel: 'Chargement des conducteurs autorisés…',
        loadingAriaLabel: 'Chargement des conducteurs autorisés',
        errorTitle: 'Impossible de charger les conducteurs autorisés',
        retryLabel: 'Réessayer',
        emptyTitle: 'Aucun conducteur autorisé enregistré',
        emptyDescription:
          'Aucun conducteur autorisé n’est encore associé à ce client dans Supabase.',
        driverCountSingular: 'conducteur',
        driverCountPlural: 'conducteurs',
        statusActive: 'Actif',
        statusInactive: 'Inactif',
        issuingCountryLabel: 'Pays de délivrance',
        licenceCategoryLabel: 'Catégorie du permis',
        licenceExpiresOnLabel: 'Expiration du permis',
        verificationStatusLabel: 'Statut de vérification',
        eligibilityLabel: 'Pré-vérification opérationnelle',
        warningsLabel: 'Alertes et vérifications',
        verificationNotesLabel: 'Notes de vérification internes',
        legalNotice:
          'Pré-vérification opérationnelle uniquement : ne constitue pas une preuve d’aptitude légale à conduire. Vérifiez le permis physique et les règles du pays avant remise du véhicule.',
        verificationStatuses: {
          unverified: 'Non vérifié',
          pending: 'En attente',
          verified: 'Vérifié',
          rejected: 'Refusé',
        },
        eligibilityStatuses: {
          blocked: 'Bloqué',
          attention_required: 'À vérifier',
          checks_passed_manual_review_required: 'Contrôles OK · Vérif. manuelle',
        },
        flagMessages: {
          driver_inactive: 'Ce conducteur est désactivé pour ce client.',
          licence_expiry_missing:
            'Date d’expiration du permis non renseignée.',
          licence_expired:
            'Le permis de conduire est expiré.',
          licence_expires_during_rental:
            'Le permis expire avant la fin de la période de location.',
          licence_expiring_soon:
            'Le permis de conduire arrive bientôt à expiration.',
          verification_unverified:
            'Le permis n’a pas encore été vérifié manuellement.',
          verification_pending:
            'La vérification du permis est en attente.',
          verification_rejected:
            'La vérification du conducteur a été refusée.',
          licence_category_missing:
            'Catégorie de permis non renseignée.',
          licence_category_mismatch:
            'La catégorie du permis peut ne pas correspondre au véhicule.',
          issuing_country_missing:
            'Pays de délivrance du permis non renseigné.',
          foreign_licence_manual_check:
            'Permis étranger : vérifier la validité locale (et le permis international si requis).',
        },
        addForm: {
          addButtonLabel: 'Ajouter un conducteur',
          title: 'Ajouter un conducteur autorisé',
          subtitle:
            'Le conducteur sera enregistré avec le statut « Non vérifié » jusqu’à vérification manuelle par l’agence.',
          fullNameLabel: 'Nom complet du conducteur',
          fullNamePlaceholder: 'Ex. Youssef Trabelsi',
          issuingCountryLabel: 'Pays de délivrance',
          issuingCountryEmptyOption: 'Non renseigné (facultatif)',
          licenceCategoryLabel: 'Catégorie du permis',
          licenceCategoryEmptyOption: 'Non renseignée (facultatif)',
          licenceExpiresOnLabel: 'Date d’expiration du permis',
          licenceExpiresOnHelper:
            'Facultatif. Aucun numéro ni copie de permis n’est collecté ici.',
          cancelLabel: 'Annuler',
          submitLabel: 'Enregistrer le conducteur',
          submittingLabel: 'Enregistrement…',
          createSuccessBanner:
            'Conducteur autorisé ajouté avec le statut « Non vérifié ».',
          dismissBannerLabel: 'Fermer',
        },
        editForm: {
          editButtonLabel: 'Modifier',
          editButtonAriaPrefix: 'Modifier le conducteur',
          title: 'Modifier le conducteur',
          subtitle:
            'Modifiez uniquement le nom complet et les métadonnées de permis de ce conducteur.',
          cancelLabel: 'Annuler',
          saveLabel: 'Enregistrer',
          savingLabel: 'Enregistrement…',
          noChangesMessage: 'Aucune modification à enregistrer.',
          verifiedLicenceChangeWarning:
            'Ce conducteur est actuellement marqué « Vérifié ». Toute modification du nom ou des informations du permis réinitialise automatiquement son statut à « Non vérifié » et exige une nouvelle vérification manuelle.',
          updateSuccessBanner: 'Informations du conducteur mises à jour.',
          updateSuccessVerifiedReviewBanner:
            'Informations du conducteur mises à jour. Le statut de vérification a été réinitialisé à « Non vérifié » et nécessite une nouvelle vérification manuelle.',
        },
        verificationForm: {
          buttonLabel: 'Vérification',
          buttonAriaPrefix: 'Gérer la vérification de',
          title: 'Vérification du conducteur',
          manualReviewNotice:
            'Le statut « Vérifié » atteste uniquement d’un contrôle manuel interne par votre agence : il ne constitue pas une preuve légale d’aptitude à conduire.',
          statusLabel: 'Statut de vérification',
          notesLabel: 'Notes internes de vérification',
          notesPlaceholder:
            'Notes privées réservées au propriétaire et au gérant (facultatif)…',
          notesHelper:
            'Visibles uniquement par le propriétaire et le gérant (jamais exposées aux agents). Max. 1000 caractères.',
          clearNotesLabel: 'Effacer les notes',
          cancelLabel: 'Annuler',
          saveLabel: 'Enregistrer la vérification',
          savingLabel: 'Enregistrement…',
          noChangesMessage: 'Aucune modification de vérification à enregistrer.',
          updateSuccessBanner:
            'Statut et notes de vérification mis à jour.',
        },
        activation: {
          deactivateButtonLabel: 'Désactiver',
          reactivateButtonLabel: 'Réactiver',
          deactivateAriaPrefix: 'Désactiver le conducteur',
          reactivateAriaPrefix: 'Réactiver le conducteur',
          confirmDeactivateTitle: 'Désactiver ce conducteur autorisé ?',
          confirmDeactivateBody:
            'Ce conducteur ne sera plus considéré comme disponible opérationnellement. Son dossier, son historique d’audit et son statut de vérification sont conservés sans suppression.',
          confirmDeactivateButton: 'Confirmer la désactivation',
          cancelLabel: 'Annuler',
          updatingLabel: 'Mise à jour…',
          deactivatedSuccessBanner:
            'Conducteur désactivé (non disponible opérationnellement).',
          reactivatedSuccessBanner: 'Conducteur réactivé.',
        },
      },
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
        'Operational overview of your rental agency connected to Supabase PostgreSQL.',
      emptyTitle: 'No operational records yet',
      emptyDescription:
        'Your agency vehicles, customers, and reservations will appear here as soon as they are created.',
      plannedFeatureSummary: 'Fleet summary, daily bookings, and real-time TND indicators.',
    },
    vehicles: {
      navLabel: 'Vehicles',
      title: 'Vehicles',
      description:
        'Fleet registry, registration plates, vehicle categories, daily rates in TND, and live availability.',
      emptyTitle: 'No vehicles recorded',
      emptyDescription:
        'Your fleet records will appear here once the vehicle management module is enabled in Phase 5.',
      plannedFeatureSummary: 'Vehicle profiles, TND pricing, odometer logs, insurance, and documents.',
    },
    customers: {
      navLabel: 'Customers',
      title: 'Customers',
      description:
        'Individual and corporate customer directory for your agency, connected to Supabase PostgreSQL.',
      emptyTitle: 'No customers recorded',
      emptyDescription:
        'No customers have been recorded for this agency in Supabase yet.',
      plannedFeatureSummary: 'Customer directory, multi-field search, and type filtering.',
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
        'Live schedule of vehicle pickups, returns and ongoing rentals in your agency timezone.',
      emptyTitle: 'No scheduled movements',
      emptyDescription:
        'Select a date to see your agency reservations and handover activities.',
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
        'As planned, no Gemini API integration or AI calls are active yet.',
      plannedFeatureSummary: 'Natural-language queries on fleet availability, alerts, and summaries.',
    },
    settings: {
      navLabel: 'Settings',
      title: 'Agency Settings',
      description:
        'Configure your agency legal identity, contact details, and Tunisia regional defaults.',
      emptyTitle: 'Agency settings loaded',
      emptyDescription:
        'The details shown below are loaded directly from your persisted agency record in Supabase PostgreSQL.',
      plannedFeatureSummary: 'Agency profile, TND currency, Africa/Tunis timezone, VAT, and team.',
    },
  },
  common: {
    phase1Label: 'KIRALIS · Agency workspace',
    phase1NoticeTitle: 'Operational module in preparation',
    phase1NoticeBody:
      'Your Supabase account and agency are connected. This operational module will be enabled in an upcoming phase; zero fabricated data is displayed.',
    moduleNotImplemented: 'Upcoming module',
    plannedFor: 'Scheduled for',
    noDatabaseConnected: '0 records',
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
    upcomingActionNote: 'Available when this module is enabled',
  },
  dashboard: {
    metricsHeading: 'Agency indicators',
    metricsFootnote:
      'Real counts from Supabase: 0 displayed whenever your agency has no records yet.',
    kpiFleet: 'Fleet vehicles',
    kpiActiveRentals: 'Active rentals',
    kpiPendingReturns: 'Returns due today',
    kpiMonthlyRevenue: 'Monthly revenue',
    kpiSubZero: '0 recorded',
    kpiSubNoDb: '0 recorded',
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
        status: 'Active',
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
      'No pickups, returns, or maintenance events are scheduled for this date.',
    legendHint: 'Reference timezone: Africa/Tunis (UTC+1).',
  },
  assistant: {
    noticeTitle: 'AI Assistant in preparation',
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
    validationSuccessTitle: 'Form validated',
    validationSuccessBody:
      'All entered fields match the expected agency profile format.',
    validationErrorSummary: 'Please fix the highlighted fields before continuing.',
    errors: {
      required: 'This field is required.',
      invalid_email: 'Please enter a valid email address.',
      invalid_phone: 'Please enter a valid phone number (8 to 20 characters).',
      invalid_vat: 'VAT rate must be between 0 and 100.',
    },
  },
  customersDirectory: {
    title: 'Customers',
    description:
      'Browse and filter individual and corporate customers registered in your agency.',
    refreshLabel: 'Refresh',
    refreshAriaLabel: 'Refresh customer directory',
    refreshingLabel: 'Refreshing…',
    retryLabel: 'Retry',
    loadErrorFallback:
      'Unable to refresh the customer directory from Supabase.',
    networkError: 'Network error while loading customers.',
    roles: {
      owner: 'Owner',
      manager: 'Manager',
      agent: 'Agent',
    },
    stats: {
      totalLabel: 'Total customers',
      totalNote: 'Registered in your agency',
      individualLabel: 'Individuals',
      individualNote: 'Personal accounts',
      corporateLabel: 'Companies',
      corporateNote: 'Corporate accounts',
      withEmailLabel: 'With email',
      withEmailNote: 'Email address on file',
    },
    searchPlaceholder: 'Search by name, company, email, or phone…',
    searchAriaLabel: 'Search customer directory',
    typeFilterAriaLabel: 'Filter by customer type',
    typeFilters: {
      all: 'All',
      individual: 'Individuals',
      corporate: 'Companies',
    },
    typeBadges: {
      individual: 'Individual',
      corporate: 'Company',
    },
    sortAriaLabel: 'Sort customers',
    sortPrefix: 'Sort',
    sortOptions: {
      newest: 'Newest first',
      oldest: 'Oldest first',
      name_asc: 'Name (A → Z)',
      name_desc: 'Name (Z → A)',
    },
    resetFiltersLabel: 'Reset',
    tableAriaLabel: 'Agency customer directory',
    columns: {
      customer: 'Customer',
      type: 'Type',
      phone: 'Phone',
      email: 'Email',
      city: 'City',
      createdAt: 'Created',
    },
    emptyAgencyTitle: 'No customers registered in your agency',
    emptyAgencyDescription:
      'Your agency does not have any customer records in Supabase yet. Registered customers will appear here automatically.',
    emptyFilterTitle: 'No customers match your filters',
    emptyFilterDescription:
      'Adjust your search query or reset active filters to view the full customer directory.',
    notProvided: 'Not provided',
    loadingLabel: 'Loading customer directory…',
    addButtonLabel: 'Add customer',
    addFirstButtonLabel: 'Add first customer',
    createSuccessBanner: 'Customer saved successfully to the directory.',
    dismissBannerLabel: 'Dismiss',
    addModal: {
      title: 'Add customer',
      subtitle: 'Create an individual or company customer record for your agency.',
      closeAriaLabel: 'Close modal',
      sectionIdentity: 'Identity',
      sectionContact: 'Contact details',
      sectionAddress: 'Address',
      sectionNotes: 'Internal notes',
      customerTypeLabel: 'Customer type',
      fullNameLabel: 'Full name',
      fullNamePlaceholder: 'e.g. Sami Ben Ali',
      companyNameLabel: 'Company name',
      companyNamePlaceholder: 'e.g. Atlas Mobility SARL',
      phoneLabel: 'Phone',
      phonePlaceholder: '+216 22 123 456',
      phoneHelper: 'International format recommended (e.g. +216 22 123 456).',
      emailLabel: 'Email',
      emailPlaceholder: 'customer@example.tn',
      addressLabel: 'Address',
      addressPlaceholder: 'e.g. 12 Avenue Habib Bourguiba',
      cityLabel: 'City',
      cityPlaceholder: 'e.g. Tunis',
      countryLabel: 'Country',
      notesLabel: 'Internal notes',
      notesPlaceholder: 'Helpful notes for your team (optional)…',
      cancelLabel: 'Cancel',
      submitLabel: 'Save customer',
      submittingLabel: 'Saving…',
      validationSummaryError: 'Please fix the highlighted fields below.',
    },
    detailDrawer: {
      kicker: 'Customer profile',
      loadingTitle: 'Loading customer profile…',
      loadingAriaLabel: 'Loading customer details',
      errorTitle: 'Unable to load this customer profile',
      closeAriaLabel: 'Close customer profile',
      closeLabel: 'Close',
      retryLabel: 'Retry',
      openDetailAriaPrefix: 'View customer profile for',
      sectionIdentity: 'Identity',
      sectionContact: 'Contact details',
      sectionAddress: 'Address & country',
      sectionNotes: 'Internal notes',
      sectionTimestamps: 'Record timestamps',
      customerTypeLabel: 'Customer type',
      fullNameLabel: 'Full name',
      companyNameLabel: 'Company name',
      phoneLabel: 'Phone',
      emailLabel: 'Email',
      addressLabel: 'Address',
      cityLabel: 'City',
      countryLabel: 'Country',
      notesLabel: 'Internal notes',
      noNotesLabel: 'No internal notes recorded.',
      createdAtLabel: 'Created on',
      updatedAtLabel: 'Last updated',
      editButtonLabel: 'Edit',
      editTitle: 'Edit customer',
      editSubtitle: 'Update the editable details for this customer profile.',
      saveLabel: 'Save changes',
      savingLabel: 'Saving…',
      cancelLabel: 'Cancel',
      noChangesMessage: 'No changes to save.',
      updateSuccessBanner: 'Customer profile updated successfully.',
      drivers: {
        sectionTitle: 'Authorized drivers',
        refreshLabel: 'Refresh',
        refreshAriaLabel: 'Refresh authorized drivers',
        loadingLabel: 'Loading authorized drivers…',
        loadingAriaLabel: 'Loading authorized drivers',
        errorTitle: 'Unable to load authorized drivers',
        retryLabel: 'Retry',
        emptyTitle: 'No authorized drivers registered',
        emptyDescription:
          'No authorized drivers are linked to this customer in Supabase yet.',
        driverCountSingular: 'driver',
        driverCountPlural: 'drivers',
        statusActive: 'Active',
        statusInactive: 'Inactive',
        issuingCountryLabel: 'Issuing country',
        licenceCategoryLabel: 'Licence category',
        licenceExpiresOnLabel: 'Licence expiry',
        verificationStatusLabel: 'Verification status',
        eligibilityLabel: 'Operational pre-check',
        warningsLabel: 'Checks & warnings',
        verificationNotesLabel: 'Internal verification notes',
        legalNotice:
          'Operational pre-check only: this never proves legal driving eligibility. Inspect the physical driving licence and apply local jurisdiction rules before vehicle handover.',
        verificationStatuses: {
          unverified: 'Unverified',
          pending: 'Pending',
          verified: 'Verified',
          rejected: 'Rejected',
        },
        eligibilityStatuses: {
          blocked: 'Blocked',
          attention_required: 'Attention required',
          checks_passed_manual_review_required: 'Checks passed · Manual review',
        },
        flagMessages: {
          driver_inactive: 'This driver is marked inactive for this customer.',
          licence_expiry_missing:
            'Driving licence expiration date is missing.',
          licence_expired:
            'Driving licence has expired.',
          licence_expires_during_rental:
            'Driving licence expires before the rental period ends.',
          licence_expiring_soon:
            'Driving licence is approaching expiration.',
          verification_unverified:
            'Driving licence has not been manually verified yet.',
          verification_pending:
            'Driving licence verification is pending.',
          verification_rejected:
            'Driver verification has been rejected.',
          licence_category_missing:
            'Driving licence category is missing.',
          licence_category_mismatch:
            'Driving licence category may not cover the target vehicle.',
          issuing_country_missing:
            'Driving licence issuing country is missing.',
          foreign_licence_manual_check:
            'Foreign licence: verify local acceptance rules and international permit requirements.',
        },
        addForm: {
          addButtonLabel: 'Add driver',
          title: 'Add authorized driver',
          subtitle:
            'New drivers are saved as Unverified until manually reviewed by your agency.',
          fullNameLabel: 'Driver full name',
          fullNamePlaceholder: 'e.g. Youssef Trabelsi',
          issuingCountryLabel: 'Licence issuing country',
          issuingCountryEmptyOption: 'Not specified (optional)',
          licenceCategoryLabel: 'Licence category',
          licenceCategoryEmptyOption: 'Not specified (optional)',
          licenceExpiresOnLabel: 'Licence expiration date',
          licenceExpiresOnHelper:
            'Optional. No licence numbers or document scans are collected here.',
          cancelLabel: 'Cancel',
          submitLabel: 'Save driver',
          submittingLabel: 'Saving…',
          createSuccessBanner:
            'Authorized driver added with Unverified status.',
          dismissBannerLabel: 'Dismiss',
        },
        editForm: {
          editButtonLabel: 'Edit',
          editButtonAriaPrefix: 'Edit driver',
          title: 'Edit driver details',
          subtitle:
            'Update only the full name and driving licence metadata for this driver.',
          cancelLabel: 'Cancel',
          saveLabel: 'Save changes',
          savingLabel: 'Saving…',
          noChangesMessage: 'No changes to save.',
          verifiedLicenceChangeWarning:
            'This driver is currently marked Verified. Updating the driver’s name or licence metadata automatically resets verification status to Unverified and requires a fresh manual review.',
          updateSuccessBanner: 'Driver details updated.',
          updateSuccessVerifiedReviewBanner:
            'Driver details updated. Verification status has been reset to Unverified and requires renewed manual review.',
        },
        verificationForm: {
          buttonLabel: 'Verification',
          buttonAriaPrefix: 'Manage verification for',
          title: 'Driver verification',
          manualReviewNotice:
            '“Verified” records an internal manual agency review only and never represents a legal determination of driving eligibility.',
          statusLabel: 'Verification status',
          notesLabel: 'Internal verification notes',
          notesPlaceholder:
            'Private notes for Owner and Manager only (optional)…',
          notesHelper:
            'Visible only to Owners and Managers (never shown to Agents). Max 1,000 characters.',
          clearNotesLabel: 'Clear notes',
          cancelLabel: 'Cancel',
          saveLabel: 'Save verification',
          savingLabel: 'Saving…',
          noChangesMessage: 'No verification changes to save.',
          updateSuccessBanner: 'Driver verification updated.',
        },
        activation: {
          deactivateButtonLabel: 'Deactivate',
          reactivateButtonLabel: 'Reactivate',
          deactivateAriaPrefix: 'Deactivate driver',
          reactivateAriaPrefix: 'Reactivate driver',
          confirmDeactivateTitle: 'Deactivate this authorized driver?',
          confirmDeactivateBody:
            'This driver will no longer be operationally available for rentals. Historical records, audit trail, and verification status are preserved without deletion.',
          confirmDeactivateButton: 'Confirm deactivation',
          cancelLabel: 'Cancel',
          updatingLabel: 'Updating…',
          deactivatedSuccessBanner:
            'Driver deactivated (not operationally available).',
          reactivatedSuccessBanner: 'Driver reactivated.',
        },
      },
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
        'نظرة تشغيلية شاملة لوكالة كراء السيارات المتصلة بقاعدة بيانات Supabase PostgreSQL.',
      emptyTitle: 'لا توجد سجلات تشغيلية بعد',
      emptyDescription:
        'ستظهر السيارات والحرفاء والحجوزات الخاصة بوكالتك هنا فور تسجيلها.',
      plannedFeatureSummary: 'ملخص الأسطول والحجوزات اليومية والمؤشرات المالية بالدينار التونسي.',
    },
    vehicles: {
      navLabel: 'السيارات',
      title: 'السيارات',
      description:
        'سجل الأسطول وأرقام التسجيل التونسية والفئات والتعريفات اليومية بالدينار التونسي وحالة التوفر.',
      emptyTitle: 'لا توجد سيارات مسجلة',
      emptyDescription:
        'ستظهر سيارات الوكالة هنا فور تفعيل وحدة إدارة السيارات في المرحلة 5.',
      plannedFeatureSummary: 'بطاقات السيارات، التسعير بالدينار التونسي، العداد والوثائق.',
    },
    customers: {
      navLabel: 'الحرفاء',
      title: 'الحرفاء',
      description:
        'دليل الحرفاء الأفراد والشركات المسجلين في وكالتك والمتصل بقاعدة بيانات Supabase PostgreSQL.',
      emptyTitle: 'لا يوجد حرفاء مسجلون',
      emptyDescription:
        'لا يوجد أي حريف مسجل لهذه الوكالة في Supabase حالياً.',
      plannedFeatureSummary: 'دليل الحرفاء، البحث متعدد المعايير والفرز حسب النوع.',
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
        'جدول عمليات التسليم والإرجاع والكراء الجاري بتوقيت وكالتك المحلي.',
      emptyTitle: 'لا توجد مواعيد مجدولة',
      emptyDescription:
        'اختر تاريخاً لعرض حجوزات الوكالة وعمليات تسليم السيارات وإرجاعها.',
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
        'وفق خطة التطوير، لم يتم تفعيل الاتصال بواجهة Gemini بعد.',
      plannedFeatureSummary: 'استفسارات باللغة الطبيعية حول الأسطول والتنبيهات والملخصات.',
    },
    settings: {
      navLabel: 'الإعدادات',
      title: 'إعدادات الوكالة',
      description:
        'إعداد الهوية القانونية وبيانات الاتصال والإعدادات الإقليمية لوكالتك في تونس.',
      emptyTitle: 'تم تحميل إعدادات الوكالة',
      emptyDescription:
        'البيانات المعروضة محملة مباشرة من سجل وكالتك المحفوظ في Supabase PostgreSQL.',
      plannedFeatureSummary: 'ملف الوكالة، الدينار التونسي، توقيت تونس والضريبة.',
    },
  },
  common: {
    phase1Label: 'KIRALIS · مساحة الوكالة',
    phase1NoticeTitle: 'وحدة تشغيلية قيد الإعداد',
    phase1NoticeBody:
      'حساب Supabase ووكالتك متصلان حالياً. سيتم تفعيل عمليات هذه الوحدة في مرحلة لاحقة دون عرض أي بيانات وهمية.',
    moduleNotImplemented: 'وحدة قادمة',
    plannedFor: 'مبرمج في',
    noDatabaseConnected: '0 سجل',
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
    upcomingActionNote: 'متاح عند تفعيل هذه الوحدة',
  },
  dashboard: {
    metricsHeading: 'مؤشرات الوكالة',
    metricsFootnote:
      'قيم حقيقية من Supabase: يظهر الصفر عندما لا توجد سجلات في الوكالة بعد.',
    kpiFleet: 'سيارات الأسطول',
    kpiActiveRentals: 'عمليات الكراء الجارية',
    kpiPendingReturns: 'الاسترجاعات المتوقعة اليوم',
    kpiMonthlyRevenue: 'مداخيل الشهر',
    kpiSubZero: '0 مسجل',
    kpiSubNoDb: '0 مسجل',
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
        status: 'مفعل',
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
      'لا توجد عمليات تسليم أو استرجاع أو صيانة مجدولة في هذا التاريخ.',
    legendHint: 'المنطقة الزمنية المرجعية: Africa/Tunis (UTC+1).',
  },
  assistant: {
    noticeTitle: 'المساعد الذكي قيد الإعداد',
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
    validationSuccessTitle: 'تم التحقق من صيغة النموذج',
    validationSuccessBody:
      'جميع الحقول المدخلة مطابقة لصيغة ملف الوكالة المطلوبة.',
    validationErrorSummary: 'يرجى تصحيح الحقول المحددة قبل المتابعة.',
    errors: {
      required: 'هذا الحقل مطلوب.',
      invalid_email: 'يرجى إدخال بريد إلكتروني صالح.',
      invalid_phone: 'يرجى إدخال رقم هاتف صالح (من 8 إلى 20 حرفاً).',
      invalid_vat: 'يجب أن تكون النسبة بين 0 و 100.',
    },
  },
  customersDirectory: {
    title: 'الحرفاء',
    description:
      'تصفح وابحث في دليل الحرفاء الأفراد والشركات المسجلين ضمن وكالتك.',
    refreshLabel: 'تحديث',
    refreshAriaLabel: 'تحديث قائمة الحرفاء',
    refreshingLabel: 'جارٍ التحديث…',
    retryLabel: 'إعادة المحاولة',
    loadErrorFallback: 'تعذر تحديث دليل الحرفاء من Supabase.',
    networkError: 'خطأ في الشبكة أثناء تحميل قائمة الحرفاء.',
    roles: {
      owner: 'المالك',
      manager: 'المدير',
      agent: 'عون',
    },
    stats: {
      totalLabel: 'إجمالي الحرفاء',
      totalNote: 'المسجلون في وكالتك',
      individualLabel: 'أفراد',
      individualNote: 'حسابات شخصية',
      corporateLabel: 'شركات',
      corporateNote: 'حسابات مهنية',
      withEmailLabel: 'ببريد إلكتروني',
      withEmailNote: 'عنوان بريد مسجل',
    },
    searchPlaceholder: 'ابحث بالاسم أو الشركة أو البريد أو الهاتف…',
    searchAriaLabel: 'البحث في دليل الحرفاء',
    typeFilterAriaLabel: 'تصفية حسب نوع الحريف',
    typeFilters: {
      all: 'الكل',
      individual: 'أفراد',
      corporate: 'شركات',
    },
    typeBadges: {
      individual: 'فرد',
      corporate: 'شركة',
    },
    sortAriaLabel: 'ترتيب الحرفاء',
    sortPrefix: 'ترتيب',
    sortOptions: {
      newest: 'الأحدث أولاً',
      oldest: 'الأقدم أولاً',
      name_asc: 'الاسم (أ ← ي)',
      name_desc: 'الاسم (ي ← أ)',
    },
    resetFiltersLabel: 'إعادة ضبط',
    tableAriaLabel: 'دليل حرفاء الوكالة',
    columns: {
      customer: 'الحريف',
      type: 'النوع',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      city: 'المدينة',
      createdAt: 'تاريخ الإضافة',
    },
    emptyAgencyTitle: 'لا يوجد حرفاء مسجلون في وكالتك',
    emptyAgencyDescription:
      'لا تحتوي وكالتك على أي سجلات حرفاء في Supabase بعد. سيظهر الحرفاء المسجلون تلقائياً في هذا الدليل.',
    emptyFilterTitle: 'لا توجد نتائج مطابقة لمعايير البحث',
    emptyFilterDescription:
      'عدّل كلمات البحث أو أعد ضبط الفلاتر النشطة لعرض جميع الحرفاء.',
    notProvided: 'غير محدد',
    loadingLabel: 'جارٍ تحميل دليل الحرفاء…',
    addButtonLabel: 'إضافة حريف',
    addFirstButtonLabel: 'إضافة أول حريف',
    createSuccessBanner: 'تم حفظ الحريف بنجاح في الدليل.',
    dismissBannerLabel: 'إغلاق',
    addModal: {
      title: 'إضافة حريف',
      subtitle: 'تسجيل حريف فرد أو شركة ضمن وكالتك.',
      closeAriaLabel: 'إغلاق النافذة',
      sectionIdentity: 'الهوية',
      sectionContact: 'بيانات الاتصال',
      sectionAddress: 'العنوان',
      sectionNotes: 'ملاحظات داخلية',
      customerTypeLabel: 'نوع الحريف',
      fullNameLabel: 'الاسم الكامل',
      fullNamePlaceholder: 'مثال: سامي بن علي',
      companyNameLabel: 'اسم الشركة',
      companyNamePlaceholder: 'مثال: أطلس موبيليتي ش.ذ.م.م',
      phoneLabel: 'الهاتف',
      phonePlaceholder: '+216 22 123 456',
      phoneHelper: 'يفضل الصيغة الدولية (مثال: +216 22 123 456).',
      emailLabel: 'البريد الإلكتروني',
      emailPlaceholder: 'client@exemple.tn',
      addressLabel: 'العنوان',
      addressPlaceholder: 'مثال: 12 شارع الحبيب بورقيبة',
      cityLabel: 'المدينة',
      cityPlaceholder: 'مثال: تونس',
      countryLabel: 'الدولة',
      notesLabel: 'ملاحظات داخلية',
      notesPlaceholder: 'ملاحظات مفيدة لفريق الوكالة (اختياري)…',
      cancelLabel: 'إلغاء',
      submitLabel: 'حفظ الحريف',
      submittingLabel: 'جارٍ الحفظ…',
      validationSummaryError: 'يرجى تصحيح الحقول المحددة أدناه.',
    },
    detailDrawer: {
      kicker: 'بطاقة الحريف',
      loadingTitle: 'جارٍ تحميل بطاقة الحريف…',
      loadingAriaLabel: 'جارٍ تحميل تفاصيل الحريف',
      errorTitle: 'تعذر عرض بطاقة هذا الحريف',
      closeAriaLabel: 'إغلاق بطاقة الحريف',
      closeLabel: 'إغلاق',
      retryLabel: 'إعادة المحاولة',
      openDetailAriaPrefix: 'عرض بطاقة الحريف',
      sectionIdentity: 'الهوية',
      sectionContact: 'بيانات الاتصال',
      sectionAddress: 'العنوان والدولة',
      sectionNotes: 'ملاحظات داخلية',
      sectionTimestamps: 'تواريخ السجل',
      customerTypeLabel: 'نوع الحريف',
      fullNameLabel: 'الاسم الكامل',
      companyNameLabel: 'اسم الشركة',
      phoneLabel: 'الهاتف',
      emailLabel: 'البريد الإلكتروني',
      addressLabel: 'العنوان',
      cityLabel: 'المدينة',
      countryLabel: 'الدولة',
      notesLabel: 'ملاحظات داخلية',
      noNotesLabel: 'لا توجد ملاحظات داخلية مسجلة.',
      createdAtLabel: 'تاريخ الإنشاء',
      updatedAtLabel: 'آخر تحديث',
      editButtonLabel: 'تعديل',
      editTitle: 'تعديل الحريف',
      editSubtitle: 'حدّث البيانات القابلة للتعديل في بطاقة هذا الحريف.',
      saveLabel: 'حفظ التغييرات',
      savingLabel: 'جارٍ الحفظ…',
      cancelLabel: 'إلغاء',
      noChangesMessage: 'لا توجد تغييرات للحفظ.',
      updateSuccessBanner: 'تم تحديث بطاقة الحريف بنجاح.',
      drivers: {
        sectionTitle: 'السائقون المعتمدون',
        refreshLabel: 'تحديث',
        refreshAriaLabel: 'تحديث قائمة السائقين المعتمدين',
        loadingLabel: 'جارٍ تحميل السائقين المعتمدين…',
        loadingAriaLabel: 'جارٍ تحميل السائقين المعتمدين',
        errorTitle: 'تعذر تحميل السائقين المعتمدين',
        retryLabel: 'إعادة المحاولة',
        emptyTitle: 'لا يوجد سائقون معتمدون مسجلون',
        emptyDescription:
          'لا يوجد أي سائق معتمد مرتبط بهذا الحريف في Supabase حالياً.',
        driverCountSingular: 'سائق',
        driverCountPlural: 'سائقين',
        statusActive: 'نشط',
        statusInactive: 'غير نشط',
        issuingCountryLabel: 'بلد إصدار الرخصة',
        licenceCategoryLabel: 'صنف الرخصة',
        licenceExpiresOnLabel: 'تاريخ انتهاء الرخصة',
        verificationStatusLabel: 'حالة التحقق',
        eligibilityLabel: 'الفحص التشغيلي المسبق',
        warningsLabel: 'التنبيهات والملاحظات التشغيلية',
        verificationNotesLabel: 'ملاحظات التحقق الداخلية',
        legalNotice:
          'فحص تشغيلي مسبق فقط: لا يُثبت الأهلية القانونية للقيادة. يجب معاينة رخصة السياقة الأصلية وتطبيق قوانين بلد الكراء قبل تسليم السيارة.',
        verificationStatuses: {
          unverified: 'غير متحقق منه',
          pending: 'قيد التحقق',
          verified: 'متحقق منه',
          rejected: 'مرفوض',
        },
        eligibilityStatuses: {
          blocked: 'محظور',
          attention_required: 'يتطلب انتباهاً',
          checks_passed_manual_review_required: 'فحص سليم · مراجعة يدوية',
        },
        flagMessages: {
          driver_inactive: 'تم تعطيل هذا السائق لهذا الحريف.',
          licence_expiry_missing: 'تاريخ انتهاء رخصة السياقة غير محدد.',
          licence_expired: 'رخصة السياقة منتهية الصلاحية.',
          licence_expires_during_rental:
            'تنتهي صلاحية الرخصة قبل نهاية فترة الكراء.',
          licence_expiring_soon: 'رخصة السياقة قريبة من تاريخ الانتهاء.',
          verification_unverified: 'لم يتم التحقق يدوياً من الرخصة بعد.',
          verification_pending: 'التحقق من رخصة السياقة قيد الانتظار.',
          verification_rejected: 'تم رفض التحقق من هذا السائق.',
          licence_category_missing: 'صنف رخصة السياقة غير محدد.',
          licence_category_mismatch:
            'قد لا يتطابق صنف الرخصة مع نوع السيارة المطلوبة.',
          issuing_country_missing: 'بلد إصدار رخصة السياقة غير محدد.',
          foreign_licence_manual_check:
            'رخصة أجنبية: تحقق من شروط الاعتراف المحلي والرخصة الدولية عند الاقتضاء.',
        },
        addForm: {
          addButtonLabel: 'إضافة سائق',
          title: 'إضافة سائق معتمد',
          subtitle:
            'يتم تسجيل السائق الجديد بحالة « غير متحقق منه » إلى حين المراجعة اليدوية من قبل الوكالة.',
          fullNameLabel: 'الاسم الكامل للسائق',
          fullNamePlaceholder: 'مثال: يوسف الطرابلسي',
          issuingCountryLabel: 'بلد إصدار الرخصة',
          issuingCountryEmptyOption: 'غير محدد (اختياري)',
          licenceCategoryLabel: 'صنف الرخصة',
          licenceCategoryEmptyOption: 'غير محدد (اختياري)',
          licenceExpiresOnLabel: 'تاريخ انتهاء الرخصة',
          licenceExpiresOnHelper:
            'اختياري. لا يتم جمع أرقام الرخص أو نسخ الوثائق هنا.',
          cancelLabel: 'إلغاء',
          submitLabel: 'حفظ السائق',
          submittingLabel: 'جارٍ الحفظ…',
          createSuccessBanner:
            'تمت إضافة السائق المعتمد بحالة « غير متحقق منه ».',
          dismissBannerLabel: 'إغلاق',
        },
        editForm: {
          editButtonLabel: 'تعديل',
          editButtonAriaPrefix: 'تعديل السائق',
          title: 'تعديل بيانات السائق',
          subtitle:
            'عدّل الاسم الكامل وبيانات رخصة السياقة لهذا السائق فقط.',
          cancelLabel: 'إلغاء',
          saveLabel: 'حفظ التغييرات',
          savingLabel: 'جارٍ الحفظ…',
          noChangesMessage: 'لا توجد تغييرات للحفظ.',
          verifiedLicenceChangeWarning:
            'هذا السائق مُصنَّف حالياً « متحقق منه ». أي تعديل على الاسم أو بيانات الرخصة يعيد تلقائياً حالة التحقق إلى « غير متحقق منه » ويتطلب مراجعة يدوية جديدة.',
          updateSuccessBanner: 'تم تحديث بيانات السائق.',
          updateSuccessVerifiedReviewBanner:
            'تم تحديث بيانات السائق. تمت إعادة تعيين حالة التحقق إلى « غير متحقق منه » ويلزم إجراء تحقق يدوي جديد.',
        },
        verificationForm: {
          buttonLabel: 'التحقق',
          buttonAriaPrefix: 'إدارة التحقق للسائق',
          title: 'التحقق من السائق',
          manualReviewNotice:
            'حالة « متحقق منه » تسجل مراجعة يدوية داخلية من قبل الوكالة فقط ولا تُعد إثباتاً قانونياً للأهلية للقيادة.',
          statusLabel: 'حالة التحقق',
          notesLabel: 'ملاحظات التحقق الداخلية',
          notesPlaceholder:
            'ملاحظات خاصة بالمالك والمدير فقط (اختياري)…',
          notesHelper:
            'مرئية فقط للمالك والمدير (لا تُعرض للأعوان أبداً). الحد الأقصى 1000 حرف.',
          clearNotesLabel: 'مسح الملاحظات',
          cancelLabel: 'إلغاء',
          saveLabel: 'حفظ التحقق',
          savingLabel: 'جارٍ الحفظ…',
          noChangesMessage: 'لا توجد تغييرات في التحقق للحفظ.',
          updateSuccessBanner: 'تم تحديث حالة وملاحظات التحقق بنجاح.',
        },
        activation: {
          deactivateButtonLabel: 'تعطيل',
          reactivateButtonLabel: 'إعادة تفعيل',
          deactivateAriaPrefix: 'تعطيل السائق',
          reactivateAriaPrefix: 'إعادة تفعيل السائق',
          confirmDeactivateTitle: 'تأكيد تعطيل هذا السائق المعتمد؟',
          confirmDeactivateBody:
            'لن يكون هذا السائق متاحاً تشغيلياً للكراء. يتم الاحتفاظ بالسجل التاريخي وسجل التدقيق وحالة التحقق دون حذف.',
          confirmDeactivateButton: 'تأكيد التعطيل',
          cancelLabel: 'إلغاء',
          updatingLabel: 'جارٍ التحديث…',
          deactivatedSuccessBanner:
            'تم تعطيل السائق (غير متاح تشغيلياً).',
          reactivatedSuccessBanner: 'تمت إعادة تفعيل السائق.',
        },
      },
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
