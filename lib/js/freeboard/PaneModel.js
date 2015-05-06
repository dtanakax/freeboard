// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function PaneModel(theFreeboardModel, widgetPlugins) {
    'use strict';

    var self = this;
    var MAX_COLUMN_WIDTH = 20;

    this.title = ko.observable();
    this.width = ko.observable(1);
    this.row = {};
    this.col = {};

    this.col_width = ko.observable(1);
    this.col_width.subscribe(function(newValue) {
        self.processSizeChange();
    });

    this.widgets = ko.observableArray();

    this.incColWidth = function() {
        var i = this.col_width();
        if (i < MAX_COLUMN_WIDTH) {
            this.col_width(i + 1);
            freeboard.resize();
        }
    };

    this.decColWidth = function() {
        var i = this.col_width();
        if (i > 1) {
            this.col_width(i - 1);
            freeboard.resize();
        }
    };

    this.canIncColWidth = function() {
        return this.col_width() < MAX_COLUMN_WIDTH ? true : false;
    };

    this.canDecColWidth = function() {
        return this.col_width() > 1 ? true : false;
    };

    this.addWidget = function (widget) {
        this.widgets.push(widget);
    };

    this.widgetCanMoveUp = function (widget) {
        return (self.widgets.indexOf(widget) >= 1);
    };

    this.widgetCanMoveDown = function (widget) {
        var i = self.widgets.indexOf(widget);
        return (i < self.widgets().length - 1);
    };

    this.moveWidgetUp = function (widget) {
        if (self.widgetCanMoveUp(widget)) {
            var i = self.widgets.indexOf(widget);
            var array = self.widgets();
            self.widgets.splice(i - 1, 2, array[i], array[i - 1]);
        }
    };

    this.moveWidgetDown = function (widget) {
        if (self.widgetCanMoveDown(widget)) {
            var i = self.widgets.indexOf(widget);
            var array = self.widgets();
            self.widgets.splice(i, 2, array[i + 1], array[i]);
        }
    };

    this.processSizeChange = function() {
        // Give the animation a moment to complete. Really hacky.
        // TODO: Make less hacky. Also, doesn't work when screen resizes.
        var resize = _.debounce(function() {
                _.each(self.widgets(), function (widget) {
                    widget.processSizeChange();
                });
            }, 500);
        resize();
    };

    this.getCalculatedHeight = function () {
        var memo = 0;
        var sumHeights = _.reduce(self.widgets(), function (memo, widget) {
            return memo + widget.height();
        }, 0);

        sumHeights *= 6;
        sumHeights += 3;

        sumHeights *= 10;

        var rows = Math.ceil((sumHeights + 20) / 30);

        return Math.max(4, rows);
    };

    this.serialize = function () {
        var widgets = [];

        _.each(self.widgets(), function (widget) {
            widgets.push(widget.serialize());
        });

        return {
            title: self.title(),
            width: self.width(),
            row: self.row,
            col: self.col,
            col_width: self.col_width(),
            widgets: widgets
        };
    };

    this.deserialize = function (object) {
        self.title(object.title);
        self.width(object.width);

        self.row = object.row;
        self.col = object.col;
        self.col_width(object.col_width || 1);

        _.each(object.widgets, function (widgetConfig) {
            var widget = new WidgetModel(theFreeboardModel, widgetPlugins);
            widget.deserialize(widgetConfig);
            self.widgets.push(widget);
        });
    };

    this.dispose = function () {
        _.each(self.widgets(), function (widget) {
            widget.dispose();
        });
    };
}
