import React, { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Specialist } from '@/types';
import { Star, MapPin, Briefcase, CheckCircle, Search } from 'lucide-react';

const SubscriptionPage = () => {
  const { state } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');

  const specialists: Specialist[] = state.specialists || [];

  const categories = [
    'Все',
    'Бухгалтерия',
    'Юристы',
    'Маркетинг',
    'Дизайн',
    'HR',
    'IT',
    'Фото и видео',
  ];

  const filtered = specialists.filter((s) => {
    const matchesCategory =
      selectedCategory === 'Все' || s.category === selectedCategory;

    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.profession.toLowerCase().includes(search.toLowerCase()) ||
      s.location.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Маркетплейс специалистов
        </h1>

        <p className="text-sm text-gray-500">
          Найдите проверенных фрилансеров и экспертов для вашего бизнеса
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

          <input
            type="text"
            placeholder="Поиск по имени, профессии или городу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-lg">
                    {s.name.slice(0, 1)}
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                      {s.name}
                    </h3>

                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      {s.profession}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-lg text-amber-700 dark:text-amber-400 text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{s.rating}</span>
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                {s.bio}
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-500 border-t dark:border-gray-700 pt-3">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{s.location}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>{s.projects} проектов</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t dark:border-gray-700 pt-3 mt-2">
              <div>
                <span className="text-xs text-gray-400">
                  Услуги от
                </span>

                <p className="text-base font-bold text-gray-900 dark:text-white">
                  {s.price.toLocaleString()} ₸
                </p>
              </div>

              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Связаться</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default SubscriptionPage;
