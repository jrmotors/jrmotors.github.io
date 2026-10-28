/*!
 * JR Motors — site configuration
 * ---------------------------------------------------------------
 * Single source of truth for contacts, hours, map and prices.
 * Edit values here; main.js fills every [data-contact] link and
 * every [data-contact-text] label on the page from this object.
 *
 * NOTE: the JSON-LD block in index.html is refreshed from this file
 * at runtime (telephone / openingHours), but keep its static copy
 * roughly in sync for crawlers that don't run JavaScript.
 */
window.JR_CONFIG = {
  /* ---- Phone & messengers ------------------------------------ */
  phone: '+77763096199',            // used in tel: links
  phoneDisplay: '8 776 309 61 99',  // shown to visitors
  whatsapp: '77763096199',          // wa.me id (digits only)
  instagram: 'joha_0999',           // username without @

  /* ---- Address ----------------------------------------------- */
  address: {
    ru: 'г. Туркестан, ул. Сарайшык, 25',
    kz: 'Түркістан қаласы, Сарайшық көшесі, 25'
  },

  /* ---- Working hours (PLACEHOLDER — not confirmed by client) -- */
  hours: {
    ru: 'Пн–Сб 09:00–19:00, Вс — выходной',
    kz: 'Дс–Сн 09:00–19:00, Жс — демалыс'
  },
  hoursSchema: ['Mo-Sa 09:00-19:00'], // schema.org openingHours format

  /* ---- Maps -------------------------------------------------- */
  mapQuery: 'Туркестан, улица Сарайшык 25', // Google Maps embed query
  twoGisQuery: 'Сарайшык 25',               // 2GIS search query
  twoGisCity: 'turkestan',

  /* ---- Company ----------------------------------------------- */
  foundedYear: 1995,

  /* ---- Prices (tenge, "from") --------------------------------
   * cat: 'light' — легковые, 'truck' — грузовые, 'mobile' — выезд
   * Order in this array = order on the page.
   */
  PRICES: [
    { cat: 'light', ru: 'Компьютерная диагностика',        kz: 'Компьютерлік диагностика',              from: 5000 },
    { cat: 'light', ru: 'Замена масла (работа)',           kz: 'Май ауыстыру (жұмыс)',                  from: 3000 },
    { cat: 'light', ru: 'Техническое обслуживание',        kz: 'Техникалық қызмет көрсету',             from: 10000 },
    { cat: 'light', ru: 'Диагностика ходовой',             kz: 'Жүріс бөлігінің диагностикасы',          from: 3000 },
    { cat: 'light', ru: 'Замена тормозных колодок (ось)',  kz: 'Тежегіш қалыптарын ауыстыру (бір ось)',  from: 5000 },
    { cat: 'light', ru: 'Ремонт ходовой части',            kz: 'Жүріс бөлігін жөндеу',                  from: 8000 },
    { cat: 'light', ru: 'Автоэлектрика',                   kz: 'Автоэлектрика',                         from: 5000 },
    { cat: 'light', ru: 'Ремонт КПП',                      kz: 'Беріліс қорабын жөндеу',                from: 60000 },
    { cat: 'light', ru: 'Капитальный ремонт двигателя',    kz: 'Қозғалтқышты күрделі жөндеу',           from: 150000 },

    { cat: 'truck', ru: 'Компьютерная диагностика',        kz: 'Компьютерлік диагностика',              from: 10000 },
    { cat: 'truck', ru: 'Техническое обслуживание',        kz: 'Техникалық қызмет көрсету',             from: 20000 },
    { cat: 'truck', ru: 'Ремонт пневмосистемы и тормозов', kz: 'Пневможүйе мен тежегіштерді жөндеу',    from: 15000 },
    { cat: 'truck', ru: 'Ремонт ходовой',                  kz: 'Жүріс бөлігін жөндеу',                  from: 20000 },
    { cat: 'truck', ru: 'Ремонт КПП',                      kz: 'Беріліс қорабын жөндеу',                from: 150000 },
    { cat: 'truck', ru: 'Капитальный ремонт двигателя',    kz: 'Қозғалтқышты күрделі жөндеу',           from: 300000 },

    { cat: 'mobile', ru: 'Выездной мастер по городу',      kz: 'Қала ішінде шеберді шақыру',            from: 10000 },
    { cat: 'mobile', ru: 'Эвакуатор (легковой) по городу', kz: 'Қала ішінде эвакуатор (жеңіл көлік)',   from: 15000 }
  ]
};
