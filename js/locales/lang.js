// Detect language & Redirect URL
(function() {
    'use strict';

    function getQueryParams() {
        var vars = {}, max = 0, hash = "", array = "";
        var url = window.location.search;
        if (url === '')
            return vars;

        hash  = url.slice(1).split('&');
        max = hash.length;
        for (var i = 0; i < max; i++) {
            array = hash[i].split('=');
            vars[array[0]] = decodeURIComponent(array[1]);
        }
        return vars;
    }

    function makeQueryParams(params) {
        return Object.keys(params).map(function(key) {
            return [key, params[key]].map(encodeURIComponent).join("=");
        }).join("&");
    }

    var supported_languages = [
        'en',
        'ja'
    ];

    var lang = window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage;
    lang = lang.substring(0,2);

    var query = getQueryParams();
    if (query.lang !== undefined) {
        if (supported_languages.indexOf(query.lang) == -1) {
            query.lang = lang;
            window.location.search = makeQueryParams(query);
        }
    } else {
        if (supported_languages.indexOf(lang) === -1) {
            lang = 'en';
        }
        query.lang = lang;
        window.location.search = makeQueryParams(query);
    }
})();