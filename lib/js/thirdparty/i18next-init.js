// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

// i18next initialize
(function($) {
    'use strict';

    i18n.debug = false;

    var options = {
        resGetPath: 'js/locales/__lng__.json',
        lowerCaseLng: true,
        fallbackLng: 'en',
        getAsync: false,
        detectLngQS: 'lang'
    };
    i18n.init(options);

}(jQuery));