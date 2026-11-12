const API_ENDPOINTS = {
    auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        me: 'GET /api/auth/me',
        logout: 'POST /api/auth/logout'
    },
    brokers: {
        list: 'GET /api/brokers',
        integration: 'GET /api/brokers/integration',
        link: 'POST /api/brokers/integration/link',
        unlink: 'DELETE /api/brokers/integration',
        saveAutoEntry: 'PUT /api/brokers/integration/auto-entry'
    },
    generator: {
        status: 'GET /api/generator/status',
        start: 'POST /api/generator/start',
        cancel: 'POST /api/generator/cancel',
        scheduleEntry: 'POST /api/generator/schedule-entry'
    },
    autopilot: {
        status: 'GET /api/autopilot/status',
        saveSettings: 'PUT /api/autopilot/settings',
        listAssets: 'GET /api/autopilot/assets',
        activate: 'POST /api/autopilot/activate',
        deactivate: 'POST /api/autopilot/deactivate',
        operations: 'GET /api/autopilot/operations'
    },
    plans: 'GET /api/plans',
    economicCalendar: 'GET /api/economic-calendar'
};

module.exports = { API_ENDPOINTS };