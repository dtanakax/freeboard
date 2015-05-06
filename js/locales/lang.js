// Detect language
(function() {
    'use strict';

    var supported_languages = [
        'en',
        'ja'
    ];

    function getParameterByName(name) {
        name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'), results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    var lang = window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage;
    lang = lang.substring(0,2);

    var qlang = getParameterByName('lang');
    if (qlang !== '') {
        if (supported_languages.indexOf(qlang) == -1) {
            location.search = location.search.replace('lang='+qlang, 'lang='+lang);
        }
    } else {
        if (supported_languages.indexOf(lang) === -1) {
            lang = 'en'
        }
        location.search += 'lang=' + lang;
    }
})();