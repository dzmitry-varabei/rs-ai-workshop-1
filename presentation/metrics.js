// Файл для обновления метрик проекта
// Можно вызывать из консоли браузера или обновлять вручную в index.html

const projectMetrics = {
    // Основные метрики
    prCount: 0,           // Количество созданных Pull Requests
    linesCount: 0,         // Количество написанных строк кода
    timeSpent: 0,          // Часов потрачено на разработку
    filesCount: 0,         // Количество созданных файлов
    testsCount: 0,         // Количество написанных тестов
    commitsCount: 0,       // Количество коммитов
    daysCount: 1,          // Количество дней работы

    // Детальная статистика для графиков
    progressData: {
        days: ['День 1', 'День 2', 'День 3', 'День 4', 'День 5'],
        linesOfCode: [0, 0, 0, 0, 0],
        prsCreated: [0, 0, 0, 0, 0]
    },

    prTypes: {
        feature: 0,
        fix: 0,
        docs: 0,
        refactor: 0
    },

    weeklyActivity: {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0
    }
};

// Функция для обновления метрик
function updateMetrics(newMetrics) {
    Object.assign(projectMetrics, newMetrics);
    
    // Обновляем на странице, если она открыта
    if (typeof window !== 'undefined' && window.updateProjectMetrics) {
        window.updateProjectMetrics(projectMetrics);
    }
    
    return projectMetrics;
}

// Пример использования:
// updateMetrics({ prCount: 5, linesCount: 1500, timeSpent: 12 });

module.exports = { projectMetrics, updateMetrics };

