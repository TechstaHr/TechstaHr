const moment = require('moment-timezone');

const getAllTimezones = () => {
    return moment.tz.names();
};

module.exports = getAllTimezones;