import type {
  AppState,
  Transaction,
  DocumentItem,
  Client,
  Task,
  Employee,
  AppNotification,
  CalendarEvent,
  Specialist,
  PaymentRequest,
} from '@/types';

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function dateTimeOffset(days: number, time: string): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10) + 'T' + time + ':00';
}

export const INCOME_CATEGORIES = [
  'Продажа услуги',
  'Консультация',
  'Подписка',
  'Партнёрство',
  'Прочий доход',
];

export const EXPENSE_CATEGORIES = [
  'Аренда офиса',
  'Реклама',
  'Зарплата',
  'Подписка',
  'Налоги',
  'Покупка оборудования',
  'Коммунальные услуги',
  'Прочие расходы',
];

const transactions: Transaction[] = [
  { id: 't1', type: 'income', amount: 480000, category: 'Продажа услуги', description: 'Разработка сайта для ТОО «Альфа»', date: dateOffset(-2), status: 'completed', account: 'Основной счёт' },
  { id: 't2', type: 'income', amount: 320000, category: 'Консультация', description: 'Консультация по маркетингу', date: dateOffset(-5), status: 'completed', account: 'Основной счёт' },
  { id: 't3', type: 'expense', amount: 180000, category: 'Аренда офиса', description: 'Аренда за сентябрь', date: dateOffset(-3), status: 'completed', account: 'Основной счёт' },
  { id: 't4', type: 'expense', amount: 95000, category: 'Реклама', description: 'Таргет в Instagram', date: dateOffset(-6), status: 'completed', account: 'Основной счёт' },
  { id: 't5', type: 'expense', amount: 420000, category: 'Зарплата', description: 'Зарплата сотрудникам', date: dateOffset(-7), status: 'completed', account: 'Основной счёт' },
  { id: 't6', type: 'income', amount: 250000, category: 'Подписка', description: 'Абонентское обслуживание', date: dateOffset(-8), status: 'completed', account: 'Основной счёт' },
  { id: 't7', type: 'expense', amount: 18000, category: 'Подписка', description: 'Figma + Notion', date: dateOffset(-10), status: 'completed', account: 'Основной счёт' },
  { id: 't8', type: 'expense', amount: 64000, category: 'Налоги', description: 'Налоги за квартал', date: dateOffset(-12), status: 'pending', account: 'Основной счёт' },
  { id: 't9', type: 'income', amount: 390000, category: 'Продажа услуги', description: 'Брендинг для Asia Cafe', date: dateOffset(-14), status: 'completed', account: 'Основной счёт' },
  { id: 't10', type: 'expense', amount: 120000, category: 'Покупка оборудования', description: 'Монитор и клавиатура', date: dateOffset(-16), status: 'completed', account: 'Основной счёт' },
  { id: 't11', type: 'income', amount: 280000, category: 'Партнёрство', description: 'Партнёрский проект с NextLab', date: dateOffset(-18), status: 'completed', account: 'Основной счёт' },
  { id: 't12', type: 'expense', amount: 45000, category: 'Коммунальные услуги', description: 'Интернет и электричество', date: dateOffset(-20), status: 'completed', account: 'Основной счёт' },
  { id: 't13', type: 'income', amount: 350000, category: 'Продажа услуги', description: 'Мобильное приложение для LogiGo', date: dateOffset(-22), status: 'completed', account: 'Основной счёт' },
  { id: 't14', type: 'expense', amount: 28000, category: 'Прочие расходы', description: 'Канцелярия', date: dateOffset(-24), status: 'completed', account: 'Основной счёт' },
  { id: 't15', type: 'income', amount: 410000, category: 'Консультация', description: 'Аудит UX для FinApp', date: dateOffset(-26), status: 'completed', account: 'Основной счёт' },
];

const documents: DocumentItem[] = [
  { id: 'd1', name: 'Договор на разработку сайта', type: 'contract', client: 'ТОО «Альфа»', date: dateOffset(-2), status: 'signing', amount: 480000, number: 'Д-2025/014' },
  { id: 'd2', name: 'Счёт №124 за консультацию', type: 'invoice', client: 'Asia Cafe', date: dateOffset(-3), status: 'paid', amount: 320000, number: 'С-2025/124' },
  { id: 'd3', name: 'Акт выполненных работ', type: 'act', client: 'NextLab', date: dateOffset(-5), status: 'signed', amount: 280000, number: 'А-2025/008' },
  { id: 'd4', name: 'Коммерческое предложение', type: 'proposal', client: 'LogiGo', date: dateOffset(-7), status: 'draft', amount: 350000, number: 'КП-2025/003' },
  { id: 'd5', name: 'Договор на брендинг', type: 'contract', client: 'Asia Cafe', date: dateOffset(-10), status: 'signed', amount: 390000, number: 'Д-2025/013' },
  { id: 'd6', name: 'Счёт №123 за разработку', type: 'invoice', client: 'LogiGo', date: dateOffset(-12), status: 'signing', amount: 350000, number: 'С-2025/123' },
  { id: 'd7', name: 'Акт по абонентскому обслуживанию', type: 'act', client: 'ТОО «Альфа»', date: dateOffset(-15), status: 'paid', amount: 250000, number: 'А-2025/007' },
  { id: 'd8', name: 'Шаблон договора оказания услуг', type: 'template', client: '—', date: dateOffset(-30), status: 'draft', amount: 0, number: 'Ш-001' },
];

const clients: Client[] = [
  {
    id: 'c1', name: 'Ержан Мусабаев', company: 'ТОО «Альфа»', email: 'erzhan@alpha.kz', phone: '+7 701 234 56 78',
    status: 'active', dealValue: 730000, lastActivity: dateOffset(-1), avatarColor: 'accent',
    notes: [{ id: 'n1', text: 'Заинтересован в долгосрочном сотрудничестве.', date: dateOffset(-3) }],
    activities: [
      { id: 'a1', type: 'meeting', text: 'Встреча по новому проекту', date: dateOffset(-1) },
      { id: 'a2', type: 'deal', text: 'Заключён договор на разработку сайта', date: dateOffset(-2) },
      { id: 'a3', type: 'call', text: 'Обсуждение сроков', date: dateOffset(-5) },
    ],
  },
  {
    id: 'c2', name: 'Алина Жумагулова', company: 'Asia Cafe', email: 'alina@asiacafe.kz', phone: '+7 702 345 67 89',
    status: 'active', dealValue: 710000, lastActivity: dateOffset(-3), avatarColor: 'success',
    notes: [],
    activities: [
      { id: 'a4', type: 'payment', text: 'Оплата счёта №124', date: dateOffset(-3) },
      { id: 'a5', type: 'deal', text: 'Брендинг кафе', date: dateOffset(-10) },
    ],
  },
  {
    id: 'c3', name: 'Тимур Караганов', company: 'NextLab', email: 'timur@nextlab.kz', phone: '+7 705 456 78 90',
    status: 'active', dealValue: 280000, lastActivity: dateOffset(-5), avatarColor: 'warning',
    notes: [{ id: 'n2', text: 'Просит скидку на следующий проект.', date: dateOffset(-4) }],
    activities: [
      { id: 'a6', type: 'deal', text: 'Партнёрский проект', date: dateOffset(-18) },
      { id: 'a7', type: 'email', text: 'Отправлен акт выполненных работ', date: dateOffset(-5) },
    ],
  },
  {
    id: 'c4', name: 'Дина Омарова', company: 'LogiGo', email: 'dina@logigo.kz', phone: '+7 708 567 89 01',
    status: 'potential', dealValue: 350000, lastActivity: dateOffset(-7), avatarColor: 'accent',
    notes: [],
    activities: [
      { id: 'a8', type: 'meeting', text: 'Презентация коммерческого предложения', date: dateOffset(-7) },
    ],
  },
  {
    id: 'c5', name: 'Мадина Ержанова', company: 'FinApp', email: 'madina@finapp.kz', phone: '+7 707 678 90 12',
    status: 'potential', dealValue: 410000, lastActivity: dateOffset(-12), avatarColor: 'success',
    notes: [],
    activities: [
      { id: 'a9', type: 'call', text: 'Первый звонок — заинтересован в аудите UX', date: dateOffset(-12) },
    ],
  },
  {
    id: 'c6', name: 'Сержан Беков', company: 'TechHub', email: 'serzhan@techhub.kz', phone: '+7 700 789 01 23',
    status: 'archived', dealValue: 150000, lastActivity: dateOffset(-60), avatarColor: 'warning',
    notes: [],
    activities: [{ id: 'a10', type: 'deal', text: 'Разовый консалтинг', date: dateOffset(-60) }],
  },
];

const tasks: Task[] = [
  { id: 'tk1', title: 'Оплатить аренду', description: 'Аренда офиса за текущий месяц', status: 'new', priority: 'high', dueDate: dateOffset(0), dueTime: '18:00', completed: false, category: 'Финансы' },
  { id: 'tk2', title: 'Подписать договор с ТОО «Альфа»', description: 'Договор на разработку сайта', status: 'new', priority: 'high', dueDate: dateOffset(0), dueTime: '15:00', completed: false, category: 'Документы' },
  { id: 'tk3', title: 'Отправить счёт клиенту', description: 'Счёт для LogiGo', status: 'new', priority: 'medium', dueDate: dateOffset(0), dueTime: '12:00', completed: false, category: 'Финансы' },
  { id: 'tk4', title: 'Проверить выплату сотрудникам', description: 'Зарплата за месяц', status: 'new', priority: 'medium', dueDate: dateOffset(0), dueTime: '17:00', completed: false, category: 'Финансы' },
  { id: 'tk5', title: 'Дизайн лендинга для Asia Cafe', description: 'Главный экран + 3 секции', status: 'in_progress', priority: 'medium', dueDate: dateOffset(2), assignee: 'Анна Ким', completed: false, category: 'Дизайн' },
  { id: 'tk6', title: 'Аудит UX для FinApp', description: 'Подготовить отчёт по юзабилити', status: 'in_progress', priority: 'high', dueDate: dateOffset(3), assignee: 'Мария Петрова', completed: false, category: 'Анализ' },
  { id: 'tk7', title: 'Настроить таргет-рекламу', description: 'Instagram + Facebook', status: 'review', priority: 'low', dueDate: dateOffset(1), assignee: 'Данияр Садыков', completed: false, category: 'Маркетинг' },
  { id: 'tk8', title: 'Подготовить КП для нового клиента', description: 'Коммерческое предложение', status: 'done', priority: 'medium', dueDate: dateOffset(-2), assignee: 'Алексей Иванов', completed: true, category: 'Продажи' },
  { id: 'tk9', title: 'Обновить тарифы на сайте', description: 'Актуализировать страницу цен', status: 'done', priority: 'low', dueDate: dateOffset(-3), assignee: 'Данияр Садыков', completed: true, category: 'Маркетинг' },
  { id: 'tk10', title: 'Закрыть акт по NextLab', description: 'Акт выполненных работ', status: 'review', priority: 'medium', dueDate: dateOffset(1), assignee: 'Мария Петрова', completed: false, category: 'Документы' },
];

const employees: Employee[] = [
  { id: 'e1', name: 'Алексей Иванов', position: 'Менеджер', status: 'active', salary: 320000, tasksCount: 3, nextPayment: dateOffset(5), email: 'alexey@bizbox.kz', phone: '+7 701 111 22 33', joinDate: dateOffset(-400), avatarColor: 'accent', department: 'Продажи' },
  { id: 'e2', name: 'Мария Петрова', position: 'Бухгалтер', status: 'active', salary: 280000, tasksCount: 5, nextPayment: dateOffset(5), email: 'maria@bizbox.kz', phone: '+7 702 222 33 44', joinDate: dateOffset(-600), avatarColor: 'success', department: 'Финансы' },
  { id: 'e3', name: 'Данияр Садыков', position: 'Маркетолог', status: 'active', salary: 300000, tasksCount: 4, nextPayment: dateOffset(5), email: 'daniyar@bizbox.kz', phone: '+7 703 333 44 55', joinDate: dateOffset(-300), avatarColor: 'warning', department: 'Маркетинг' },
  { id: 'e4', name: 'Анна Ким', position: 'Администратор', status: 'vacation', salary: 250000, tasksCount: 2, nextPayment: dateOffset(12), email: 'anna@bizbox.kz', phone: '+7 704 444 55 66', joinDate: dateOffset(-200), avatarColor: 'accent', department: 'Администрирование' },
];

const notifications: AppNotification[] = [
  { id: 'nt1', type: 'payment', title: 'Счёт №124 ожидает оплаты', body: 'Asia Cafe — 320 000 ₸. Срок через 2 дня.', date: dateTimeOffset(0, '09:00'), read: false },
  { id: 'nt2', type: 'task', title: 'Завтра срок выплаты зарплаты', body: 'Общая сумма: 1 150 000 ₸ для 4 сотрудников.', date: dateTimeOffset(-1, '16:30'), read: false },
  { id: 'nt3', type: 'client', title: 'Новый клиент добавлен', body: 'FinApp — заинтересованы в аудите UX.', date: dateTimeOffset(-2, '11:15'), read: false },
  { id: 'nt4', type: 'document', title: 'Договор готов к подписанию', body: 'Договор с ТОО «Альфа» на 480 000 ₸.', date: dateTimeOffset(-3, '14:00'), read: true },
  { id: 'nt5', type: 'system', title: 'Добро пожаловать в BIZBOX', body: 'Ваш бизнес успешно подключён. Начните с главной панели.', date: dateTimeOffset(-7, '10:00'), read: true },
];

const events: CalendarEvent[] = [
  { id: 'ev1', date: dateOffset(0), title: 'Оплатить аренду', type: 'task', color: 'accent' },
  { id: 'ev2', date: dateOffset(0), title: 'Подписать договор с ТОО «Альфа»', type: 'document', color: 'warning' },
  { id: 'ev3', date: dateOffset(0), title: 'Отправить счёт LogiGo', type: 'payment', color: 'success' },
  { id: 'ev4', date: dateOffset(1), title: 'Настроить таргет-рекламу', type: 'task', color: 'accent' },
  { id: 'ev5', date: dateOffset(1), title: 'Закрыть акт по NextLab', type: 'document', color: 'warning' },
  { id: 'ev6', date: dateOffset(2), title: 'Дизайн лендинга Asia Cafe', type: 'task', color: 'accent' },
  { id: 'ev7', date: dateOffset(3), title: 'Аудит UX для FinApp', type: 'task', color: 'accent' },
  { id: 'ev8', date: dateOffset(5), title: 'Выплата зарплаты', type: 'payment', color: 'success' },
  { id: 'ev9', date: dateOffset(5), title: 'Анна Ким — выход из отпуска', type: 'employee', color: 'danger' },
  { id: 'ev10', date: dateOffset(7), title: 'Налоги за квартал', type: 'payment', color: 'danger' },
  { id: 'ev11', date: dateOffset(10), title: 'Презентация КП для LogiGo', type: 'task', color: 'accent' },
  { id: 'ev12', date: dateOffset(14), title: 'Оплата подписки Figma', type: 'payment', color: 'success' },
];

const specialists: Specialist[] = [
  { id: 's1', name: 'Гульнара А.', profession: 'Бухгалтер', category: 'Бухгалтерия', rating: 4.9, projects: 142, price: 8000, location: 'Астана', bio: 'Ведение бухучёта, налоговая отчётность, ИП и ТОО.', avatarColor: 'accent' },
  { id: 's2', name: 'Арман Т.', profession: 'Юрист', category: 'Юристы', rating: 4.8, projects: 98, price: 12000, location: 'Алматы', bio: 'Договорная работа, корпоративное право, регистрация бизнеса.', avatarColor: 'success' },
  { id: 's3', name: 'Камила Ш.', profession: 'Маркетолог', category: 'Маркетинг', rating: 4.7, projects: 76, price: 10000, location: 'Астана', bio: 'SMM, таргетированная реклама, контент-стратегия.', avatarColor: 'warning' },
  { id: 's4', name: 'Рустем Б.', profession: 'Дизайнер', category: 'Дизайн', rating: 5.0, projects: 210, price: 15000, location: 'Алматы', bio: 'Брендинг, UI/UX, веб-дизайн, презентации.', avatarColor: 'accent' },
  { id: 's5', name: 'Ольга В.', profession: 'HR-специалист', category: 'HR', rating: 4.6, projects: 54, price: 9000, location: 'Астана', bio: 'Подбор персонала, кадровое делопроизводство.', avatarColor: 'success' },
  { id: 's6', name: 'Нурлан Ж.', profession: 'IT-специалист', category: 'IT', rating: 4.9, projects: 167, price: 18000, location: 'Шымкент', bio: 'Настройка CRM, автоматизация, интеграции, поддержка.', avatarColor: 'warning' },
  { id: 's7', name: 'Дана М.', profession: 'Фотограф', category: 'Фото и видео', rating: 4.8, projects: 120, price: 14000, location: 'Астана', bio: 'Предметная и коммерческая съёмка, видеомонтаж.', avatarColor: 'accent' },
  { id: 's8', name: 'Сания К.', profession: 'Бухгалтер', category: 'Бухгалтерия', rating: 4.7, projects: 89, price: 7000, location: 'Алматы', bio: 'Налоги для ИП, отчёты, банк-клиент.', avatarColor: 'success' },
  { id: 's9', name: 'Ербол С.', profession: 'Юрист', category: 'Юристы', rating: 4.5, projects: 43, price: 10000, location: 'Астана', bio: 'Лицензирование, разрешения, таможня.', avatarColor: 'warning' },
  { id: 's10', name: 'Айгерим Н.', profession: 'SMM-менеджер', category: 'Маркетинг', rating: 4.6, projects: 65, price: 8000, location: 'Алматы', bio: 'Контент, Reels, продвижение в Instagram.', avatarColor: 'accent' },
];

export function createSeedState(): AppState {
  return {
    user: { name: 'Ержан', email: 'demo@bizbox.app', plan: 'business' },
    business: { name: 'Nova Studio', industry: 'Digital agency', city: 'Астана', employeesCount: '4', modules: ['finance', 'documents', 'clients', 'tasks', 'employees'] },
    onboardingComplete: true,
    transactions,
    documents,
    clients,
    tasks,
    employees,
    notifications,
    events,
    specialists,
    payments: [],
  };
}

export function createNewUserState(email: string, name: string): AppState {
  return {
    user: { name, email, plan: 'free' },
    business: null,
    onboardingComplete: false,
    transactions: [],
    documents: [],
    clients: [],
    tasks: [],
    employees: [],
    notifications: [
      { id: 'nt_welcome', type: 'system', title: 'Добро пожаловать в BIZBOX', body: 'Давайте настроим ваш бизнес. Пройдите короткий онбординг.', date: new Date().toISOString(), read: false },
    ],
    events: [],
    specialists,
    payments: [],
  };
}
