// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

DatasourceModel = function(theFreeboardModel, datasourcePlugins) {
    'use strict';

    var self = this;

    function disposeDatasourceInstance()
    {
        if(!_.isUndefined(self.datasourceInstance))
        {
            if(_.isFunction(self.datasourceInstance.onDispose))
            {
                self.datasourceInstance.onDispose();
            }

            self.datasourceInstance = undefined;
        }
    }

    this.isEditing = ko.observable(false); // editing by PluginEditor
    this.name = ko.observable();
    this.latestData = ko.observable();
    this.settings = ko.observable({});
    this.settings.subscribe(function(newValue) {
        if(!_.isUndefined(self.datasourceInstance) && _.isFunction(self.datasourceInstance.onSettingsChanged))
        {
            self.datasourceInstance.onSettingsChanged(newValue);
        }
    });

    this.updateCallback = function(newData) {
        theFreeboardModel.processDatasourceUpdate(self, newData);

        self.latestData(newData);

        self.last_updated(moment().format('HH:mm:ss'));
    };

    this.type = ko.observable();
    this.type.subscribe(function(newValue)
    {
        disposeDatasourceInstance();

        if((newValue in datasourcePlugins) && _.isFunction(datasourcePlugins[newValue].newInstance))
        {
            var datasourceType = datasourcePlugins[newValue];

            var finishLoad = function() {
                datasourceType.newInstance(self.settings(), function(datasourceInstance)
                {

                    self.datasourceInstance = datasourceInstance;
                    datasourceInstance.updateNow();

                }, self.updateCallback);
            };

            // Do we need to load any external scripts?
            if(datasourceType.external_scripts)
                head.js(datasourceType.external_scripts.slice(0), finishLoad); // Need to clone the array because head.js adds some weird functions to it
            else
                finishLoad();
        }
    });

    this.last_updated = ko.observable('never');
    this.last_error = ko.observable();

    this.serialize = function()
    {
        return {
            name    : self.name(),
            type    : self.type(),
            settings: self.settings()
        };
    };

    this.deserialize = function(object)
    {
        self.settings(object.settings);
        self.name(object.name);
        self.type(object.type);
    };

    this.getDataRepresentation = function(dataPath)
    {
        var valueFunction = new Function('data', 'return ' + dataPath + ';');
        return valueFunction.call(undefined, self.latestData());
    };

    this.updateNow = function()
    {
        if(!_.isUndefined(self.datasourceInstance) && _.isFunction(self.datasourceInstance.updateNow))
        {
            self.datasourceInstance.updateNow();
        }
    };

    this.dispose = function()
    {
        disposeDatasourceInstance();
    };
};

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

DeveloperConsole = function(theFreeboardModel) {
    'use strict';

    function showDeveloperConsole()
    {
        var pluginScriptsInputs = [];
        var container = $('<div></div>');
        var addScript = $('<div class="table-operation text-button">ADD</div>');
        var table = $('<table class="table table-condensed sub-table"></table>');

        table.append($('<thead style=""><tr><th>Plugin Script URL</th></tr></thead>'));

        var tableBody = $("<tbody></tbody>");

        table.append(tableBody);

        container.append($("<p>Here you can add references to other scripts to load datasource or widget plugins.</p>"))
            .append(table)
            .append(addScript)
            .append('<p>To learn how to build plugins for freeboard, please visit <a target="_blank" href="http://freeboard.github.io/freeboard/docs/plugin_example.html">http://freeboard.github.io/freeboard/docs/plugin_example.html</a></p>');

        function refreshScript(scriptURL)
        {
            $('script[src="' + scriptURL + '"]').remove();
        }

        function addNewScriptRow(scriptURL)
        {
            var tableRow = $('<tr></tr>');
            var tableOperations = $('<ul class="board-toolbar"></ul>');
            var scriptInput = $('<input class="table-row-value" style="width:100%;" type="text">');
            var deleteOperation = $('<li><i class="fa-w fa-trash"></i></li>').click(function(e){
                pluginScriptsInputs = _.without(pluginScriptsInputs, scriptInput);
                tableRow.remove();
            });

            pluginScriptsInputs.push(scriptInput);

            if(scriptURL)
            {
                scriptInput.val(scriptURL);
            }

            tableOperations.append(deleteOperation);
            tableBody
                .append(tableRow
                .append($('<td></td>').append(scriptInput))
                .append($('<td class="table-row-operation">').append(tableOperations)));
        }

        _.each(theFreeboardModel.plugins(), function(pluginSource){

            addNewScriptRow(pluginSource);

        });

        addScript.click(function(e)
        {
            addNewScriptRow();
        });

        var db = new DialogBox(container, 'Developer Console', 'OK', null, function(okcancel){
            if (okcancel === 'ok') {
                // Unload our previous scripts
                _.each(theFreeboardModel.plugins(), function(pluginSource){

                    $('script[src^="' + pluginSource + '"]').remove();

                });

                theFreeboardModel.plugins.removeAll();

                _.each(pluginScriptsInputs, function(scriptInput){

                    var scriptURL = scriptInput.val();

                    if(scriptURL && scriptURL.length > 0)
                    {
                        theFreeboardModel.addPluginSource(scriptURL);

                        // Load the script with a cache buster
                        head.js(scriptURL + '?' + Date.now());
                    }
                });
            }
        });
    }

    // Public API
    return {
        showDeveloperConsole : function()
        {
            showDeveloperConsole();
        }
    };
};

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function DialogBox(contentElement, title, okTitle, cancelTitle, closeCallback) {
    'use strict';

    var modal_width = 900;

    // Initialize our modal overlay
    var overlay = $('<div id="modal_overlay"></div>');

    var modalDialog = $('<div class="modal"></div>');

    function closeModal()
    {
        if (head.browser.ie) {
            overlay.remove();
        } else {
            overlay.removeClass('show').addClass('hide');
            _.delay(function() {
                overlay.remove();
            }, 300);
        }
    }

    // Create our header
    modalDialog.append('<header><h2 class="title">' + title + "</h2></header>");

    $('<section></section>').appendTo(modalDialog).append(contentElement);

    // Create our footer
    var footer = $('<footer></footer>').appendTo(modalDialog);

    if(okTitle)
    {
        $('<span id="dialog-ok" class="text-button">' + okTitle + '</span>').appendTo(footer).click(function()
        {
            var hold = false;

            if (!$('#plugin-editor').validationEngine('validate'))
                return false;

            if(_.isFunction(closeCallback))
                hold = closeCallback('ok');

            if(!hold)
                closeModal();
        });
    }

    if(cancelTitle)
    {
        $('<span id="dialog-cancel" class="text-button">' + cancelTitle + '</span>').appendTo(footer).click(function()
        {
            closeCallback('cancel');
            closeModal();
        });
    }

    overlay.append(modalDialog);
    $('body').append(overlay);
    if (!head.browser.ie)
        overlay.removeClass('hide').addClass('show');

    // ValidationEngine initialize
    $.validationEngine.defaults.autoPositionUpdate = true;
    // media query max-width : 960px
    $.validationEngine.defaults.promptPosition = ($('#hamburger').css('display') == 'none') ? 'topRight' : 'topLeft';
    $('#plugin-editor').validationEngine();
}

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function FreeboardModel(datasourcePlugins, widgetPlugins, freeboardUI)
{
    var self = this;

    var SERIALIZATION_VERSION = 1;

    this.version = 0;
    this.isEditing = ko.observable(false);
    this.allow_edit = ko.observable(false);
    this.allow_edit.subscribe(function(newValue) {
        if (newValue) {
            $('#main-header').show();
        } else {
            $('#main-header').hide();
            $('#datasources').hide();
        }
    });

    this.isVisibleDatasources = ko.observable(false);
    this.isVisibleBoardTools = ko.observable(false);

    this.header_image = ko.observable();
    this.plugins = ko.observableArray();
    this.datasources = ko.observableArray();
    this.panes = ko.observableArray();
    this.datasourceData = {};
    this.processDatasourceUpdate = function(datasourceModel, newData) {
        var datasourceName = datasourceModel.name();

        self.datasourceData[datasourceName] = newData;

        _.each(self.panes(), function(pane) {
            _.each(pane.widgets(), function(widget) {
                widget.processDatasourceUpdate(datasourceName);
            });
        });
    };

    this._datasourceTypes = ko.observable();
    this.datasourceTypes = ko.computed({
        read: function() {
            self._datasourceTypes();

            var returnTypes = [];

            _.each(datasourcePlugins, function(datasourcePluginType) {
                var typeName = datasourcePluginType.type_name;
                var displayName = typeName;

                if (!_.isUndefined(datasourcePluginType.display_name))
                    displayName = datasourcePluginType.display_name;

                returnTypes.push({
                    name        : typeName,
                    display_name: displayName
                });
            });

            return returnTypes;
        }
    });

    this._widgetTypes = ko.observable();
    this.widgetTypes = ko.computed({
        read: function() {
            self._widgetTypes();

            var returnTypes = [];

            _.each(widgetPlugins, function(widgetPluginType) {
                var typeName = widgetPluginType.type_name;
                var displayName = typeName;

                if(!_.isUndefined(widgetPluginType.display_name))
                    displayName = widgetPluginType.display_name;

                returnTypes.push({
                    name        : typeName,
                    display_name: displayName
                });
            });

            return returnTypes;
        }
    });

    this.addPluginSource = function(pluginSource) {
        if (pluginSource && self.plugins.indexOf(pluginSource) === -1)
            self.plugins.push(pluginSource);
    };

    this.serialize = function() {
        var panes = [];

        _.each(self.panes(), function(pane) {
            panes.push(pane.serialize());
        });

        var datasources = [];

        _.each(self.datasources(), function(datasource) {
            datasources.push(datasource.serialize());
        });

        return {
            version     : SERIALIZATION_VERSION,
            header_image: self.header_image(),
            allow_edit  : self.allow_edit(),
            plugins     : self.plugins(),
            panes       : panes,
            datasources : datasources,
            columns     : freeboardUI.getUserColumns()
        };
    };

    this.deserialize = function(object, finishedCallback) {
        self.clearDashboard();

        function finishLoad() {
            freeboardUI.setUserColumns(object.columns);

            if (!_.isUndefined(object.allow_edit))
                self.allow_edit(object.allow_edit);
            else
                self.allow_edit(true);

            self.version = object.version || 0;
            self.header_image(object.header_image);

            _.each(object.datasources, function(datasourceConfig) {
                var datasource = new DatasourceModel(self, datasourcePlugins);
                datasource.deserialize(datasourceConfig);
                self.addDatasource(datasource);
            });

            var sortedPanes = _.sortBy(object.panes, function(pane) {
                return freeboardUI.getPositionForScreenSize(pane).row;
            });

            _.each(sortedPanes, function(paneConfig) {
                var pane = new PaneModel(self, widgetPlugins);
                pane.deserialize(paneConfig);
                self.panes.push(pane);
            });

            if (self.allow_edit() && self.panes().length === 0 && self.datasources().length === 0)
                self.setEditing(true);

            if (_.isFunction(finishedCallback))
                finishedCallback();

            freeboardUI.processResize(true, true);
        }

        // This could have been self.plugins(object.plugins), but for some weird reason head.js was causing a function to be added to the list of plugins.
        _.each(object.plugins, function(plugin) {
            self.addPluginSource(plugin);
        });

        // Load any plugins referenced in this definition
        if (_.isArray(object.plugins) && object.plugins.length > 0) {
            head.js(object.plugins, function() {
                finishLoad();
            });
        } else {
            finishLoad();
        }
    };

    this.clearDashboard = function() {
        freeboardUI.removeAllPanes();

        _.each(self.datasources(), function(datasource) {
            datasource.dispose();
        });

        _.each(self.panes(), function(pane) {
            pane.dispose();
        });

        self.plugins.removeAll();
        self.datasources.removeAll();
        self.panes.removeAll();
    };

    this.loadDashboard = function(dashboardData, callback) {
        freeboardUI.showLoadingIndicator(true);
        _.delay(function() {
            self.deserialize(dashboardData, function() {
                if(_.isFunction(callback))
                    callback();

                freeboardUI.showLoadingIndicator(false);

                freeboard.emit('dashboard_loaded');
            });
        }, 50);
    };

    this.loadDashboardFromLocalFile = function() {
        // Check for the various File API support.
        if(window.File && window.FileReader && window.FileList && window.Blob) {
            var input = document.createElement('input');
            input.id = 'myfile';
            input.type = 'file';
            $(input).css({
                'visibility':'hidden'
            });

            $(input).on('change', function(event) {
                var files = event.target.files;

                if(files && files.length > 0) {
                    var file = files[0];
                    var reader = new FileReader();

                    reader.addEventListener('load', function(fileReaderEvent) {

                        var textFile = fileReaderEvent.target;
                        var jsonObject = JSON.parse(textFile.result);


                        self.loadDashboard(jsonObject);
                        self.setEditing(false);
                    });

                    reader.readAsText(file);
                }
                if (head.browser.ie)
                    $('#myfile').remove();
            });

            if (head.browser.ie) {
                document.body.appendChild(input);
                var evt = document.createEvent('MouseEvents');
                evt.initEvent('click',true,true,window,0,0,0,0,0,false,false,false,false,0,null);
                input.dispatchEvent(evt);
            } else {
                $(input).trigger('click');
            }
        } else {
            alert('Unable to load a file in this browser.');
        }
    };

    this.saveDashboard = function() {
        var contentType = 'application/octet-stream';
        var blob = new Blob([JSON.stringify(self.serialize())], {'type': contentType});
        var file = 'dashboard.json';

        if (head.browser.ie) {
            window.navigator.msSaveBlob(blob, file);
        } else {
            var url = (window.URL || window.webkitURL);
            var data = url.createObjectURL(blob);
            var e = document.createEvent('MouseEvents');
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            var a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
            a.href = data;
            a.download = file;
            a.dispatchEvent(e);
        }
    };

    this.addDatasource = function(datasource) {
        self.datasources.push(datasource);
    };

    this.deleteDatasource = function(datasource) {
        delete self.datasourceData[datasource.name()];
        datasource.dispose();
        self.datasources.remove(datasource);
    };

    this.createPane = function() {
        var newPane = new PaneModel(self, widgetPlugins);
        self.addPane(newPane);
    };

    this.addGridColumnLeft = function() {
        freeboardUI.addGridColumnLeft();
    };

    this.addGridColumnRight = function() {
        freeboardUI.addGridColumnRight();
    };

    this.subGridColumnLeft = function() {
        freeboardUI.subGridColumnLeft();
    };

    this.subGridColumnRight = function() {
        freeboardUI.subGridColumnRight();
    };

    this.addPane = function(pane) {
        self.panes.push(pane);
    };

    this.deletePane = function(pane) {
        pane.dispose();
        self.panes.remove(pane);
    };

    this.deleteWidget = function(widget) {
        ko.utils.arrayForEach(self.panes(), function(pane) {
            pane.widgets.remove(widget);
        });

        widget.dispose();
    };

    this.updateDatasourceNameRef = function(newDatasourceName, oldDatasourceName) {
        _.each(self.panes(), function(pane) {
            _.each(pane.widgets(), function(widget) {
                widget.updateDatasourceNameRef(newDatasourceName, oldDatasourceName);
            });
        });
    };

    $.fn.transform = function(axis) {
        var ret = 0;
        var elem = this;
        var matrix = elem.css('transform').replace(/[^0-9\-.,]/g, '').split(',');
        if (axis == 'y')
            ret = matrix[13] || matrix[5];
        else if (axis == 'x')
            ret = matrix[12] || matrix[4];
        if (_.isUndefined(ret))
            ret = 0;
        return ret;
    };

    this.setEditing = function(editing, animate) {
        // Don't allow editing if it's not allowed
        if (!self.allow_edit() && editing)
            return;

        self.isEditing(editing);

        if (editing === false) {
            if (self.isVisibleDatasources())
                self.setVisibilityDatasources(false);
            if (self.isVisibleBoardTools())
                self.setVisibilityBoardTools(false);
        }

        var barHeight = $('#admin-bar').outerHeight();
        var headerHeight = $('#main-header').outerHeight();

        if (!editing) {
            freeboardUI.disableGrid();
            $('#toggle-header-icon').addClass('fa-wrench').removeClass('fa-chevron-up');
            $('.gridster .gs_w').css({cursor: 'default'});

            if (head.browser.ie) {
                $('#main-header').css('top', '-' + barHeight + 'px');
                $('#board-content').css('top', '20px');
            } else {
                $('#main-header').css('transform', 'translateY(-' + barHeight + 'px)');
                $('#board-content').css('transform', 'translateY(20px)');
                _.delay(function() {
                    $('#admin-menu').css('display', 'none');
                }, 200);
            }
            $('.sub-section').unbind();
        } else {
            $('#admin-menu').css('display', 'block');
            $('#toggle-header-icon').addClass('fa-chevron-up').removeClass('fa-wrench');
            $('.gridster .gs_w').css({cursor: 'pointer'});

            if (head.browser.ie) {
                $('#main-header').css('top', '0px');
                $('#board-content').css('top', headerHeight + 'px');
            } else {
                $('#main-header').css('transform', 'translateY(0px)');
                $('#board-content').css('transform', 'translateY(' + headerHeight + 'px)');
            }
            freeboardUI.attachWidgetEditIcons($('.sub-section'));
            freeboardUI.enableGrid();
        }

        freeboardUI.showPaneEditIcons(editing, true);
    };

    this.setVisibilityDatasources = function(visibility, animate) {
        // Don't allow editing if it's not allowed
        if(!self.allow_edit())
            return;

        self.isVisibleDatasources(visibility);

        var ds = $('#datasources');
        var width = ds.outerWidth();

        if (visibility === true) {
            ds.css('display', 'block');
            ds.css('transform', 'translateX(-' + width + 'px)');
        } else {
            ds.css('transform', 'translateX(' + width + 'px)');
            _.delay(function() {
                ds.css('display', 'none');
            }, 300);
        }
    };

    this.setVisibilityBoardTools = function(visibility, animate) {
        // Don't allow editing if it's not allowed
        if (!self.allow_edit())
            return;

        self.isVisibleBoardTools(visibility);

        var mh = $('#main-header');
        var bc = $('#board-content');
        var bt = $('#board-tools');

        var mhHeight = mh.outerHeight();
        var width = bt.outerWidth();

        var debounce = _.debounce(function() {
            // media query max-width : 960px
            if ($('#hamburger').css('display') == 'none') {
                self.setVisibilityBoardTools(false);
                $(window).off('resize', debounce);
            }
        }, 500);

        if (visibility === true) {
            $('html').addClass('boardtools-opening');
            $('#board-actions > ul').removeClass('collapse');

            if (head.browser.ie) {
                mh.offset({ top: 0, left: width });
                bc.offset({ top: mhHeight, left: width });
            } else {
                mh.css('transform', 'translate(' + width + 'px, ' + mh.transform('y') + 'px)');
                bc.css('transform', 'translate(' + width + 'px, ' + bc.transform('y') + 'px)');
            }

            $(window).resize(debounce);
        } else {
            $('html').removeClass('boardtools-opening');
            $('#board-actions > ul').addClass('collapse');

            if (head.browser.ie) {
                mh.offset({ top: 0, left: 0 });
                bc.offset({ top: mhHeight, left: 0 });
            } else {
                mh.css('transform', 'translate(0px, ' + mh.transform('y') + 'px)');
                bc.css('transform', 'translate(0px, ' + bc.transform('y') + 'px)');
            }

            $(window).off('resize', debounce);
        }
    };

    this.toggleEditing = function() {
        self.setEditing(!self.isEditing());
    };

    this.toggleDatasources = function() {
        self.setVisibilityDatasources(!self.isVisibleDatasources());
    };

    this.toggleBoardTools = function() {
        self.setVisibilityBoardTools(!self.isVisibleBoardTools());
    };
}

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function FreeboardUI() {

    var PANE_MARGIN = 10;
    var PANE_WIDTH = 300;
    var MIN_COLUMNS = 3;
    var COLUMN_WIDTH = PANE_MARGIN + PANE_WIDTH + PANE_MARGIN;

    var userColumns = MIN_COLUMNS;

    var loadingIndicator = $('<div class="wrapperloading"><div class="loading up" ></div><div class="loading down"></div></div>');
    var grid;

    function processResize(layoutWidgets, loading) {
        var maxDisplayableColumns = getMaxDisplayableColumnCount();
        var repositionFunction = function(){};

        if (layoutWidgets) {
            repositionFunction = function(index) {
                var paneElement = this;
                var paneModel = ko.dataFor(paneElement);

                var newPosition = getPositionForScreenSize(paneModel);
                $(paneElement).attr('data-sizex', Math.min(paneModel.col_width(),
                    maxDisplayableColumns, grid.cols))
                    .attr('data-row', newPosition.row)
                    .attr('data-col', newPosition.col);

                if (loading === true) {
                    // Give the animation a moment to complete. Really hacky.
                    var resize = _.debounce(function() {
                        paneModel.processSizeChange();
                    }, 500);
                    resize();
                } else {
                    paneModel.processSizeChange();
                }
            };
        }

        updateGridWidth(Math.min(maxDisplayableColumns, userColumns));

        repositionGrid(repositionFunction);
        updateGridColumnControls();
    }

    function addGridColumn(shift) {
        var num_cols = grid.cols + 1;
        if (updateGridWidth(num_cols)) {
            repositionGrid(function() {
                var paneElement = this;
                var paneModel = ko.dataFor(paneElement);

                var prevColumnIndex = grid.cols > 1 ? grid.cols - 1 : 1;
                var prevCol = paneModel.col[prevColumnIndex];
                var prevRow = paneModel.row[prevColumnIndex];
                var newPosition;
                if (shift) {
                    leftPreviewCol = true;
                    var newCol = prevCol < grid.cols ? prevCol + 1 : grid.cols;
                    newPosition = {row: prevRow, col: newCol};
                } else {
                    rightPreviewCol = true;
                    newPosition = {row: prevRow, col: prevCol};
                }
                $(paneElement).attr('data-sizex', Math.min(paneModel.col_width(), grid.cols))
                    .attr('data-row', newPosition.row)
                    .attr('data-col', newPosition.col);
            });
        }
        updateGridColumnControls();
        userColumns = grid.cols;
    }

    function subtractGridColumn(shift) {
        var num_cols = grid.cols - 1;
        if (updateGridWidth(num_cols)) {
            repositionGrid(function() {
                var paneElement = this;
                var paneModel = ko.dataFor(paneElement);

                var prevColumnIndex = grid.cols + 1;
                var prevCol = paneModel.col[prevColumnIndex];
                var prevRow = paneModel.row[prevColumnIndex];
                var newPosition, newCol;
                if (shift) {
                    newCol = prevCol > 1 ? prevCol - 1 : 1;
                    newPosition = {row: prevRow, col: newCol};
                } else {
                    newCol = prevCol <= grid.cols ? prevCol : grid.cols;
                    newPosition = {row: prevRow, col: newCol};
                }
                $(paneElement).attr('data-sizex', Math.min(paneModel.col_width(), grid.cols))
                    .attr('data-row', newPosition.row)
                    .attr('data-col', newPosition.col);
            });
        }
        updateGridColumnControls();
        userColumns = grid.cols;
    }

    function updateGridColumnControls() {
        var col_controls = $('.column-tool');
        var available_width = $('#board-content').width();
        var max_columns = Math.floor(available_width / COLUMN_WIDTH);

        if (grid.cols <= MIN_COLUMNS)
            col_controls.addClass('min');
        else
            col_controls.removeClass('min');

        if (grid.cols >= max_columns)
            col_controls.addClass('max');
        else
            col_controls.removeClass('max');
    }

    function getMaxDisplayableColumnCount() {
        var available_width = $('#board-content').width();
        return Math.floor(available_width / COLUMN_WIDTH);
    }

    function updateGridWidth(newCols) {
        if (newCols === undefined || newCols < MIN_COLUMNS)
            newCols = MIN_COLUMNS;

        var max_columns = getMaxDisplayableColumnCount();
        if (newCols > max_columns)
            newCols = max_columns;

        // +newCols to account for scaling on zoomed browsers
        var new_width = (COLUMN_WIDTH * newCols) + newCols;
        $('.responsive-column-width').css('max-width', new_width);

        return (newCols !== grid.cols);
    }

    function repositionGrid(repositionFunction) {
        var rootElement = grid.$el;

        rootElement.find('> li').unbind().removeData();
        $('.responsive-column-width').css('width', '');
        grid.generate_grid_and_stylesheet();

        rootElement.find('> li').each(repositionFunction);

        grid.init();
        $('.responsive-column-width').css('width', grid.cols * PANE_WIDTH + (grid.cols * PANE_MARGIN * 2));
    }

    function getUserColumns() {
        return userColumns;
    }

    function setUserColumns(numCols) {
        userColumns = Math.max(MIN_COLUMNS, numCols);
    }

    ko.bindingHandlers.grid = {
        init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // Initialize our grid
            grid = $(element).gridster({
                widget_margins        : [PANE_MARGIN, PANE_MARGIN],
                widget_base_dimensions: [PANE_WIDTH, 10],
                resize: {
                    enabled : false,
                    axes : 'x'
                }
            }).data('gridster');

            processResize(false);

            grid.disable();
        }
    };

    function addPane(element, viewModel, isEditing) {
        var position = getPositionForScreenSize(viewModel);
        var col = position.col;
        var row = position.row;
        var width = Number(viewModel.width());
        var height = Number(viewModel.getCalculatedHeight());

        grid.add_widget(element, width, height, col, row);

        if (isEditing)
            showPaneEditIcons(true);

        updatePositionForScreenSize(viewModel, row, col);

        $(element).attrchange({
            trackValues: true,
            callback   : function(event) {
                if (event.attributeName === 'data-row')
                    updatePositionForScreenSize(viewModel, Number(event.newValue), undefined);
                else if (event.attributeName ===  'data-col')
                    updatePositionForScreenSize(viewModel, undefined, Number(event.newValue));
            }
        });
    }

    function updatePane(element, viewModel) {
        // If widget has been added or removed
        var calculatedHeight = viewModel.getCalculatedHeight();

        var elementHeight = Number($(element).attr('data-sizey'));
        var elementWidth = Number($(element).attr('data-sizex'));

        if (calculatedHeight != elementHeight || viewModel.col_width() !=  elementWidth) {
            grid.resize_widget($(element), viewModel.col_width(), calculatedHeight, function(){
                grid.set_dom_grid_height();
            });
        }
    }

    function updatePositionForScreenSize(paneModel, row, col) {
        var displayCols = grid.cols;

        if (!_.isUndefined(row)) paneModel.row[displayCols] = row;
        if (!_.isUndefined(col)) paneModel.col[displayCols] = col;
    }

    function showLoadingIndicator(show) {
        if (show === true)
            loadingIndicator.removeClass('hide').appendTo('body').addClass('show');
        else {
            _.delay(function() {
                loadingIndicator.removeClass('show').addClass('hide');
                _.delay(function() {
                    loadingIndicator.remove();
                }, 500);
            }, 500);
        }
    }

    function showPaneEditIcons(show, animate) {
        if (_.isUndefined(animate))
            animate = true;

        if (show) {
            if (animate) {
                $('.pane-tools').css('display', 'block').removeClass('hide').addClass('show');
                $('#column-tools').css('display', 'block').removeClass('hide').addClass('show');
            } else {
                $('.pane-tools').css('display', 'block');
                $('#column-tools').css('display', 'block');
            }
        } else {
            if (animate) {
                $('.pane-tools').removeClass('show').addClass('hide');
                $('#column-tools').removeClass('show').addClass('hide');
                _.delay(function() {
                    $('.pane-tools').css('display', 'none');
                    $('#column-tools').css('display', 'none');
                }, 200);
            } else {
                $('.pane-tools').css('display', 'none');
                $('#column-tools').css('display', 'none');
            }
        }
    }

    function attachWidgetEditIcons(element) {
        $(element).hover(function() {
            showWidgetEditIcons(this, true);
        }, function(){
            showWidgetEditIcons(this, false);
        });
    }

    function showWidgetEditIcons(element, show) {
        var tool = $(element).find('.sub-section-tools');
        if (show)
            tool.css('display', 'block').removeClass('hide').addClass('show');
        else {
            tool.removeClass('show').addClass('hide');
        }
    }

    function getPositionForScreenSize(paneModel) {
        var cols = Number(grid.cols);

        if (_.isNumber(paneModel.row) && _.isNumber(paneModel.col)) { // Support for legacy format
            var obj = {};
            obj[cols] = paneModel.row;
            paneModel.row = obj;

            obj = {};
            obj[cols] = paneModel.col;
            paneModel.col = obj;
        }

        var newColumnIndex = 1;
        var columnDiff = 1000;

        for(var columnIndex in paneModel.col) {
            if (Number(columnIndex) === cols) // If we already have a position defined for this number of columns, return that position
                return {row: paneModel.row[columnIndex], col: paneModel.col[columnIndex]};
            else if (paneModel.col[columnIndex] > cols) // If it's greater than our display columns, put it in the last column
                newColumnIndex = cols;
            else { // If it's less than, pick whichever one is closest
                var delta = cols - columnIndex;

                if(delta < columnDiff) {
                    newColumnIndex = columnIndex;
                    columnDiff = delta;
                }
            }
        }

        if (newColumnIndex in paneModel.col && newColumnIndex in paneModel.row)
            return {row: paneModel.row[newColumnIndex], col: paneModel.col[newColumnIndex]};

        return {row:1,col:newColumnIndex};
    }


    // Public Functions
    return {
        showLoadingIndicator : function(show) {
            showLoadingIndicator(show);
        },

        showPaneEditIcons : function(show, animate) {
            showPaneEditIcons(show, animate);
        },

        attachWidgetEditIcons : function(element) {
            attachWidgetEditIcons(element);
        },

        getPositionForScreenSize : function(paneModel) {
            return getPositionForScreenSize(paneModel);
        },

        processResize : function(layoutWidgets, loading) {
            processResize(layoutWidgets, loading);
        },

        disableGrid : function() {
            grid.disable();
        },

        enableGrid : function() {
            grid.enable();
        },

        addPane : function(element, viewModel, isEditing) {
            addPane(element, viewModel, isEditing);
        },

        updatePane : function(element, viewModel) {
            updatePane(element, viewModel);
        },

        removePane : function(element) {
            grid.remove_widget(element);
        },

        removeAllPanes : function() {
            grid.remove_all_widgets();
        },

        addGridColumnLeft : function() {
            addGridColumn(true);
        },

        addGridColumnRight : function() {
            addGridColumn(false);
        },

        subGridColumnLeft : function() {
            subtractGridColumn(true);
        },

        subGridColumnRight : function() {
            subtractGridColumn(false);
        },

        getUserColumns : function() {
            return getUserColumns();
        },

        setUserColumns : function(numCols) {
            setUserColumns(numCols);
        }
    };
}

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

JSEditor = function() {
    'use strict';

    var assetRoot = '';

    function setAssetRoot(_assetRoot) {
        assetRoot = _assetRoot;
    }

    function displayJSEditor(value, mode, callback) {

        var exampleText;
        var codeWindow = $('<div class="code-window"></div>');
        var codeMirrorWrapper = $('<div class="code-mirror-wrapper"></div>');
        var codeWindowFooter = $('<div class="code-window-footer"></div>');
        var codeWindowHeader = $('<div class="code-window-header cm-s-ambiance"></div>');
        var config = {};

        switch (mode) {
            case 'javascript':
                exampleText = $.i18n.t('JSEditor.javascript.exampleText');
                codeWindowHeader = $('<div class="code-window-header cm-s-ambiance">' + $.i18n.t('JSEditor.javascript.codeWindowHeader') + '</div>');

                // If value is empty, go ahead and suggest something
                if (!value)
                    value = exampleText;

                config = {
                    value: value,
                    mode: 'javascript',
                    theme: 'ambiance',
                    indentUnit: 4,
                    lineNumbers: true,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    gutters: ['CodeMirror-lint-markers'],
                    lint: true
                };
                break;
            case 'json':
                exampleText = $.i18n.t('JSEditor.json.exampleText');
                codeWindowHeader = $('<div class="code-window-header cm-s-ambiance">' + $.i18n.t('JSEditor.json.codeWindowHeader') + '</div>');

                config = {
                    value: value,
                    mode: 'application/json',
                    theme: 'ambiance',
                    indentUnit: 4,
                    lineNumbers: true,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    gutters: ['CodeMirror-lint-markers'],
                    lint: true
                };
                break;
            case 'htmlmixed':
                exampleText = '';
                codeWindowHeader = $('<div class="code-window-header cm-s-ambiance">' + $.i18n.t('JSEditor.htmlmixed.codeWindowHeader') + '</div>');

                config = {
                    value: value,
                    mode: 'htmlmixed',
                    theme: 'ambiance',
                    indentUnit: 4,
                    lineNumbers: true,
                    matchBrackets: true,
                    autoCloseBrackets: true
                };
                break;
        }

        codeWindow.append([codeWindowHeader, codeMirrorWrapper, codeWindowFooter]);

        $('body').append(codeWindow);

        var codeMirrorEditor = CodeMirror(codeMirrorWrapper.get(0), config);

        var closeButton = $('<span id="dialog-cancel" class="text-button">' + $.i18n.t('JSEditor.cancel') + '</span>').click(function () {
            if (callback) {
                var newValue = codeMirrorEditor.getValue();

                if (newValue === exampleText)
                    newValue = '';

                var error = null;
                switch (mode) {
                    case 'json':
                        if (JSHINT.errors.length > 0) {
                            alert($.i18n.t('JSEditor.json.error'));
                            return;
                        }
                        break;
                }
                callback(newValue);
                codeWindow.remove();
            }
        });

        codeWindowFooter.append(closeButton);
    }

    // Public API
    return {
        displayJSEditor: function (value, mode, callback) {
            displayJSEditor(value, mode, callback);
        },
        setAssetRoot: function (assetRoot) {
            setAssetRoot(assetRoot);
        }
    };
};
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

    this.title = ko.observable();
    this.width = ko.observable(1);
    this.row = {};
    this.col = {};

    this.col_width = ko.observable(1);
    this.col_width.subscribe(function(newValue) {
        self.processSizeChange();
    });

    this.widgets = ko.observableArray();

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

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

PluginEditor = function(jsEditor, valueEditor) {
    'use strict';

    function _removeSettingsRows() {
        if ($('#setting-row-instance-name').length)
            $('#setting-row-instance-name').nextAll().remove();
        else
            $('#setting-row-plugin-types').nextAll().remove();
    }

    function _toValidateClassString(validate, type) {
        var ret = '';
        if (!_.isUndefined(validate)) {
            var types = '';
            if (!_.isUndefined(type))
                types = ' ' + type;
            ret = 'validate[' + validate + ']' + types;
        }
        return ret;
    }

    function _isNumerical(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    function _appendCalculatedSettingRow(valueCell, newSettings, settingDef, currentValue, includeRemove) {
        var input = $('<textarea></textarea>').addClass(_toValidateClassString(settingDef.validate, 'text-input')).attr('style', settingDef.style);

        if(settingDef.multi_input) {
            input.change(function() {
                var arrayInput = [];
                $(valueCell).find('textarea').each(function() {
                    var thisVal = $(this).val();
                    if(thisVal)
                        arrayInput = arrayInput.concat(thisVal);
                });
                newSettings.settings[settingDef.name] = arrayInput;
            });
        } else {
            input.change(function() {
                newSettings.settings[settingDef.name] = $(this).val();
            });
        }

        if(currentValue)
            input.val(currentValue);

        valueEditor.createValueEditor(input);

        var datasourceToolbox = $('<ul class="board-toolbar datasource-input-suffix"></ul>');
        var wrapperDiv = $('<div class="calculated-setting-row"></div>');

        wrapperDiv.append(input).append(datasourceToolbox);

        var datasourceTool = $('<li><i class="fa-w fa-plus"></i><label>' + $.i18n.t('PluginEditor.datasource_tool') + '</label></li>')
            .mousedown(function(e) {
                e.preventDefault();
                $(input).val('').focus().insertAtCaret('datasources[\"').trigger('freeboard-eval');
            });
        datasourceToolbox.append(datasourceTool);

        var jsEditorTool = $('<li><i class="fa-w fa-edit"></i><label>.JS EDITOR</label></li>')
            .mousedown(function(e) {
                e.preventDefault();
                jsEditor.displayJSEditor(input.val(), 'javascript', function(result) {
                    input.val(result);
                    input.change();
                });
            });
        datasourceToolbox.append(jsEditorTool);

        if(includeRemove) {
            var removeButton = $('<li class="remove-setting-row"><i class="fa-w fa-minus"></i><label></label></li>')
                .mousedown(function(e) {
                    e.preventDefault();
                    wrapperDiv.remove();
                    $(valueCell).find('textarea:first').change();
            });
            datasourceToolbox.prepend(removeButton);
        }

        $(valueCell).append(wrapperDiv);
    }

    function createSettingRow(form, name, displayName) {
        var tr = $('<div id="setting-row-' + name + '" class="form-row"></div>').appendTo(form);

        tr.append('<div class="form-label"><label class="control-label">' + displayName + '</label></div>');
        return $('<div id="setting-value-container-' + name + '" class="form-value"></div>').appendTo(tr);
    }

    function appendArrayCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        var subTableDiv = $('<div class="form-table-value-subtable"></div>').appendTo(valueCell);

        var subTable = $('<table class="table table-condensed sub-table"></table>').appendTo(subTableDiv);
        var subTableHead = $('<thead></thead>').hide().appendTo(subTable);
        var subTableHeadRow = $('<tr></tr>').appendTo(subTableHead);
        var subTableBody = $('<tbody></tbody>').appendTo(subTable);

        var currentSubSettingValues = [];

        // Create our headers
        _.each(settingDef.settings, function(subSettingDef) {
            var subsettingDisplayName = subSettingDef.name;

            if(!_.isUndefined(subSettingDef.display_name))
                subsettingDisplayName = subSettingDef.display_name;

            $('<th>' + subsettingDisplayName + '</th>').appendTo(subTableHeadRow);
        });

        if(settingDef.name in currentSettingsValues)
            currentSubSettingValues = currentSettingsValues[settingDef.name];

        var processHeaderVisibility = function() {
            (newSettings.settings[settingDef.name].length > 0) ? subTableHead.show() : subTableHead.hide();
        };

        var createSubsettingRow = function(subsettingValue) {
            var subsettingRow = $('<tr></tr>').appendTo(subTableBody);

            var newSetting = {};

            if(!_.isArray(newSettings.settings[settingDef.name]))
                newSettings.settings[settingDef.name] = [];

            newSettings.settings[settingDef.name].push(newSetting);

            _.each(settingDef.settings, function(subSettingDef) {
                var subsettingCol = $('<td></td>').appendTo(subsettingRow);
                var subsettingValueString = '';

                if(!_.isUndefined(subsettingValue[subSettingDef.name]))
                    subsettingValueString = subsettingValue[subSettingDef.name];

                newSetting[subSettingDef.name] = subsettingValueString;

                $('<input class="table-row-value" type="text">')
                        .addClass(_toValidateClassString(subSettingDef.validate, 'text-input'))
                        .attr('style', settingDef.style)
                        .appendTo(subsettingCol).val(subsettingValueString).change(function() {
                    newSetting[subSettingDef.name] = $(this).val();
                });
            });

            subsettingRow.append($('<td class="table-row-operation"></td>').append($('<ul class="board-toolbar"></ul>').append($('<li></li>').append($('<i class="fa-w fa-trash"></i>').click(function() {
                                    var subSettingIndex = newSettings.settings[settingDef.name].indexOf(newSetting);

                                    if(subSettingIndex !== -1) {
                                        newSettings.settings[settingDef.name].splice(subSettingIndex, 1);
                                        subsettingRow.remove();
                                        processHeaderVisibility();
                                    }
                                })))));

            subTableDiv.scrollTop(subTableDiv[0].scrollHeight);

            processHeaderVisibility();
        };

        $('<div class="table-operation text-button">' + $.i18n.t('PluginEditor.table_operation') + '</div>').appendTo(valueCell).click(function() {
            var newSubsettingValue = {};

            _.each(settingDef.settings, function(subSettingDef) {
                newSubsettingValue[subSettingDef.name] = '';
            });

            createSubsettingRow(newSubsettingValue);
        });

        // Create our rows
        _.each(currentSubSettingValues, function(currentSubSettingValue, subSettingIndex) {
            createSubsettingRow(currentSubSettingValue);
        });
    }

    function appendBooleanCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        var onOffSwitch = $('<div class="onoffswitch"><label class="onoffswitch-label" for="' + settingDef.name + '-onoff"><div class="onoffswitch-inner"><span class="on">' + $.i18n.t('global.yes') + '</span><span class="off">' + $.i18n.t('global.no') + '</span></div><div class="onoffswitch-switch"></div></label></div>').appendTo(valueCell);

        var input = $('<input type="checkbox" name="onoffswitch" class="onoffswitch-checkbox" id="' + settingDef.name + '-onoff">').prependTo(onOffSwitch).change(function() {
            newSettings.settings[settingDef.name] = this.checked;
        });

        if(settingDef.name in currentSettingsValues)
            input.prop('checked', currentSettingsValues[settingDef.name]);
    }

    function appendOptionCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        var defaultValue = currentSettingsValues[settingDef.name];

        var input = $('<select></select>')
                            .addClass(_toValidateClassString(settingDef.validate))
                            .attr('style', settingDef.style)
                            .appendTo($('<div class="styled-select"></div>')
                            .appendTo(valueCell)).change(function() {
            newSettings.settings[settingDef.name] = $(this).val();
        });

        _.each(settingDef.options, function(option) {
            var optionName;
            var optionValue;

            if (_.isObject(option)) {
                optionName = option.name;
                optionValue = option.value;
            } else {
                optionName = option;
            }

            if (_.isUndefined(optionValue))
                optionValue = optionName;

            if (_.isUndefined(defaultValue))
                defaultValue = optionValue;

            $('<option></option>').text(optionName).attr('value', optionValue).appendTo(input);
        });

        newSettings.settings[settingDef.name] = defaultValue;

        if(settingDef.name in currentSettingsValues)
            input.val(currentSettingsValues[settingDef.name]);
    }

    function appendColorCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        var curColorPickerID = _.uniqueId('picker-');
        var thisColorPickerID = '#' + curColorPickerID;
        var defaultValue = currentSettingsValues[settingDef.name];
        var input = $('<input id="' + curColorPickerID + '" type="text">').addClass(_toValidateClassString(settingDef.validate, 'text-input')).appendTo(valueCell);

        newSettings.settings[settingDef.name] = defaultValue;

        $(thisColorPickerID).css({
            'border-right':'30px solid green',
            'width':'80px'
        });

        $(thisColorPickerID).css('border-color', defaultValue);

        var defhex = defaultValue;
        defhex.replace('#', '');

        $(thisColorPickerID).colpick({
            layout:'hex',
            colorScheme:'dark',
            color: defhex,
            submit:0,
            onChange:function(hsb,hex,rgb,el,bySetColor) {
                $(el).css('border-color','#'+hex);
                newSettings.settings[settingDef.name] = '#'+hex;
                if(!bySetColor) {
                    $(el).val('#'+hex);
                }
            }
        }).keyup(function(){
            $(this).colpickSetColor(this.value);
        });

        if(settingDef.name in currentSettingsValues) {
            input.val(currentSettingsValues[settingDef.name]);
        }
    }

    function appendJsonCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        var input = $('<textarea class="calculated-value-input" style="z-index: 3000"></textarea>')
                .addClass(_toValidateClassString(settingDef.validate, 'text-input'))
                .attr('style', settingDef.style)
                .appendTo(valueCell).change(function() {
            newSettings.settings[settingDef.name] = $(this).val();
        });

        if(settingDef.name in currentSettingsValues)
            input.val(currentSettingsValues[settingDef.name]);

        valueEditor.createValueEditor(input);

        var datasourceToolbox = $('<ul class="board-toolbar datasource-input-suffix"></ul>');

        var jsEditorTool = $('<li><i class="fa-w fa-edit"></i><label>.JSON EDITOR</label></li>').mousedown(function(e) {
            e.preventDefault();

            jsEditor.displayJSEditor(input.val(), 'json', function(result){
                input.val(result);
                input.change();
            });
        });

        $(valueCell).append(datasourceToolbox.append(jsEditorTool));
    }

    function appendHtmlMixedCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        var input = $('<textarea class="calculated-value-input" style="z-index: 3000"></textarea>')
                .addClass(_toValidateClassString(settingDef.validate, 'text-input'))
                .attr('style', settingDef.style)
                .appendTo(valueCell).change(function() {
            newSettings.settings[settingDef.name] = $(this).val();
        });

        if(settingDef.name in currentSettingsValues)
            input.val(currentSettingsValues[settingDef.name]);

        valueEditor.createValueEditor(input);

        var datasourceToolbox = $('<ul class="board-toolbar datasource-input-suffix"></ul>');

        var jsEditorTool = $('<li><i class="fa-w fa-edit"></i><label>.HTML EDITOR</label></li>').mousedown(function(e) {
            e.preventDefault();

            jsEditor.displayJSEditor(input.val(), 'htmlmixed', function(result){
                input.val(result);
                input.change();
            });
        });

        $(valueCell).append(datasourceToolbox.append(jsEditorTool));
    }

    function appendTextCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        var input = $('<input type="text">')
                            .addClass(_toValidateClassString(settingDef.validate, 'text-input'))
                            .attr('style', settingDef.style)
                            .appendTo(valueCell).change(function() {
            if (settingDef.type == 'number')
                newSettings.settings[settingDef.name] = Number($(this).val());
            else
                newSettings.settings[settingDef.name] = $(this).val();
        });

        if (settingDef.name in currentSettingsValues)
            input.val(currentSettingsValues[settingDef.name]);
    }

    function appendCalculatedCell(form, valueCell, settingDef, currentSettingsValues, newSettings) {
        newSettings.settings[settingDef.name] = currentSettingsValues[settingDef.name];

        if (settingDef.name in currentSettingsValues) {
            var currentValue = currentSettingsValues[settingDef.name];
            if(settingDef.multi_input && _.isArray(currentValue)) {
                var includeRemove = false;
                for(var i = 0; i < currentValue.length; i++) {
                    _appendCalculatedSettingRow(valueCell, newSettings, settingDef, currentValue[i], includeRemove);
                    includeRemove = true;
                }
            } else {
                _appendCalculatedSettingRow(valueCell, newSettings, settingDef, currentValue, false);
            }
        } else {
            _appendCalculatedSettingRow(valueCell, newSettings, settingDef, null, false);
        }

        if (settingDef.multi_input) {
            var inputAdder = $('<ul class="board-toolbar"><li class="add-setting-row"><i class="fa-w fa-plus"></i><label>' + $.i18n.t('PluginEditor.tableOperation') + '</label></li></ul>')

                .mousedown(function(e) {
                    e.preventDefault();
                    _appendCalculatedSettingRow(valueCell, newSettings, settingDef, null, true);
                });
            $(valueCell).siblings('.form-label').append(inputAdder);
        }
    }

    function createPluginEditor(title, pluginTypes, currentTypeName, currentSettingsValues, settingsSavedCallback, cancelCallback) {
        var newSettings = {
            type    : currentTypeName,
            settings: {}
        };

        var selectedType;
        var form = $('<form id="plugin-editor"></form>');

        var pluginDescriptionElement = $('<div id="plugin-description"></div>').hide();
        form.append(pluginDescriptionElement);

        function createSettingsFromDefinition(settingsDefs) {

            _.each(settingsDefs, function(settingDef) {
                // Set a default value if one doesn't exist
                if(!_.isUndefined(settingDef.default_value) && _.isUndefined(currentSettingsValues[settingDef.name]))
                    currentSettingsValues[settingDef.name] = settingDef.default_value;

                var displayName = settingDef.name;

                if(!_.isUndefined(settingDef.display_name))
                    displayName = settingDef.display_name;

                settingDef.style = _.isUndefined(settingDef.style) ? '' : settingDef.style;

                // modify required field name
                if(!_.isUndefined(settingDef.validate)) {
                    if (settingDef.validate.indexOf('required') != -1) {
                        displayName = '* ' + displayName;
                    }
                }

                // unescape text value
                if (settingDef.type === 'text')
                    currentSettingsValues[settingDef.name] = _.unescape(currentSettingsValues[settingDef.name]);

                var valueCell = createSettingRow(form, settingDef.name, displayName);
                var input, defaultValue;

                switch (settingDef.type) {
                    case 'array':
                        appendArrayCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'boolean':
                        appendBooleanCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'option':
                        appendOptionCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'color':
                        appendColorCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'htmlmixed':
                        appendHtmlMixedCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'json':
                        appendJsonCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'text':
                        appendTextCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    case 'calculated':
                        appendCalculatedCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                    default:
                        appendTextCell(form, valueCell, settingDef, currentSettingsValues, newSettings);
                        break;
                }

                if (!_.isUndefined(settingDef.suffix))
                    valueCell.append($('<div class="input-suffix">' + settingDef.suffix + '</div>'));

                if (!_.isUndefined(settingDef.description))
                    valueCell.append($('<div class="setting-description">' + settingDef.description + '</div>'));
            });
        }

        var db = new DialogBox(form, title, $.i18n.t('PluginEditor.dialog.yes'), $.i18n.t('PluginEditor.dialog.no'), function(okcancel) {
            if (okcancel === 'ok') {
                // escape text value
                _.each(selectedType.settings, function(def) {
                    if (def.type === 'text')
                        newSettings.settings[def.name] = _.escape(newSettings.settings[def.name]);
                });

                if (_.isFunction(settingsSavedCallback))
                    settingsSavedCallback(newSettings);
            } else if (okcancel === 'cancel') {
                if (_.isFunction(cancelCallback))
                    cancelCallback();
            }
            // Remove colorpick dom objects
            $('[id^=collorpicker]').remove();
        });

        // Create our body
        var pluginTypeNames = _.keys(pluginTypes);
        var typeSelect;

        if (pluginTypeNames.length > 1) {
            var typeRow = createSettingRow(form, 'plugin-types', $.i18n.t('PluginEditor.type'));
            typeSelect = $('<select></select>').appendTo($('<div class="styled-select"></div>').appendTo(typeRow));

            typeSelect.append($('<option>'+$.i18n.t('PluginEditor.first_option')+'</option>').attr('value', 'undefined'));

            _.each(pluginTypes, function(pluginType) {
                typeSelect.append($('<option></option>').text(pluginType.display_name).attr('value', pluginType.type_name));
            });

            typeSelect.change(function() {
                newSettings.type = $(this).val();
                newSettings.settings = {};

                // Remove all the previous settings
                _removeSettingsRows();

                selectedType = pluginTypes[typeSelect.val()];

                if (_.isUndefined(selectedType)) {
                    $('#setting-row-instance-name').hide();
                    $('#dialog-ok').hide();
                } else {
                    $('#setting-row-instance-name').show();

                    if(selectedType.description && selectedType.description.length > 0)
                        pluginDescriptionElement.html(selectedType.description).show();
                    else
                        pluginDescriptionElement.hide();

                    $('#dialog-ok').show();
                    createSettingsFromDefinition(selectedType.settings);
                }
            });
        } else if (pluginTypeNames.length === 1) {
            selectedType = pluginTypes[pluginTypeNames[0]];
            newSettings.type = selectedType.type_name;
            newSettings.settings = {};
            createSettingsFromDefinition(selectedType.settings);
        }

        if (typeSelect) {
            if (_.isUndefined(currentTypeName)) {
                $('#setting-row-instance-name').hide();
                $('#dialog-ok').hide();
            } else {
                $('#dialog-ok').show();
                typeSelect.val(currentTypeName).trigger('change');
            }
        }
    }

    // Public API
    return {
        createPluginEditor : function(
                    title,
                    pluginTypes,
                    currentInstanceName,
                    currentTypeName,
                    currentSettingsValues,
                    settingsSavedCallback) {
            createPluginEditor(title, pluginTypes, currentInstanceName, currentTypeName, currentSettingsValues, settingsSavedCallback);
        }
    };
};
// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

ValueEditor = function(theFreeboardModel) {
    'use strict';

    var _veDatasourceRegex = new RegExp('.*datasources\\[\"([^\"]*)(\"\\])?(.*)$');

    var dropdown = null;
    var selectedOptionIndex = 0;
    var _autocompleteOptions = [];
    var currentValue = null;

    var EXPECTED_TYPE = {
        ANY : 'any',
        ARRAY : 'array',
        OBJECT : 'object',
        STRING : 'string',
        NUMBER : 'number',
        BOOLEAN : 'boolean'
    };

    function _isPotentialTypeMatch(value, expectsType) {
        if(_.isArray(value) || _.isObject(value))
            return true;
        return _isTypeMatch(value, expectsType);
    }

    function _isTypeMatch(value, expectsType) {
        switch(expectsType) {
        case EXPECTED_TYPE.ANY: return true;
        case EXPECTED_TYPE.ARRAY: return _.isArray(value);
        case EXPECTED_TYPE.OBJECT: return _.isObject(value);
        case EXPECTED_TYPE.STRING: return _.isString(value);
        case EXPECTED_TYPE.NUMBER: return _.isNumber(value);
        case EXPECTED_TYPE.BOOLEAN: return _.isBoolean(value);
        }
    }

    function _checkCurrentValueType(element, expectsType) {
        $(element).parent().find('.validation-error').remove();
        if(!_isTypeMatch(currentValue, expectsType)) {
            $(element).parent().append('<div class="validation-error">' +
                'This field expects an expression that evaluates to type ' +
                expectsType + '.</div>');
        }
    }

    function _resizeValueEditor(element) {
        var lineBreakCount = ($(element).val().match(/\n/g) || []).length;

        var newHeight = Math.min(200, 20 * (lineBreakCount + 1));

        $(element).css({height: newHeight + 'px'});
    }

    function _autocompleteFromDatasource(inputString, datasources, expectsType) {
        var match = _veDatasourceRegex.exec(inputString);

        var options = [];

        if (match) {
            if (match[1] === '') {
                // Editor value is: datasources["; List all datasources
                _.each(datasources, function(datasource) {
                    options.push({value: datasource.name(), entity: undefined,
                        precede_char: '', follow_char: '\"]'});
                });
            } else if (match[1] !== '' && _.isUndefined(match[2])) {
                // Editor value is a partial match for a datasource; list matching datasources
                var replacementString = match[1];

                _.each(datasources, function(datasource) {
                    var dsName = datasource.name();

                    if(dsName != replacementString && dsName.indexOf(replacementString) === 0) {
                        options.push({value: dsName, entity: undefined,
                            precede_char: '', follow_char: '\"]'});
                    }
                });
            } else {
                // Editor value matches a datasources; parse JSON in order to populate list
                // We already have a datasource selected; find it
                var datasource = _.find(datasources, function(datasource) {
                    return (datasource.name() === match[1]);
                });

                if (!_.isUndefined(datasource)) {
                    var dataPath = 'data';
                    var remainder = '';

                    // Parse the partial JSON selectors
                    if (!_.isUndefined(match[2])) {
                        // Strip any incomplete field values, and store the remainder
                        var remainderIndex = match[3].lastIndexOf(']') + 1;
                        dataPath = dataPath + match[3].substring(0, remainderIndex);
                        remainder = match[3].substring(remainderIndex, match[3].length);
                        remainder = remainder.replace(/^[\[\"]*/, '');
                        remainder = remainder.replace(/[\"\]]*$/, '');
                    }

                    // Get the data for the last complete JSON field
                    var dataValue = datasource.getDataRepresentation(dataPath);
                    currentValue = dataValue;

                    // For arrays, list out the indices
                    if (_.isArray(dataValue)) {
                        for(var index = 0; index < dataValue.length; index++) {
                            if (index.toString().indexOf(remainder) === 0) {
                                var value = dataValue[index];
                                if (_isPotentialTypeMatch(value, expectsType)) {
                                    options.push({value: index, entity: value,
                                        precede_char: '[', follow_char: ']',
                                        preview: value.toString()});
                                }
                            }
                        }
                    } else if(_.isObject(dataValue)) {
                        // For objects, list out the keys
                        _.each(dataValue, function(value, name) {
                            if (name.indexOf(remainder) === 0) {
                                if (_isPotentialTypeMatch(value, expectsType)) {
                                    options.push({value: name, entity: value,
                                        precede_char: '[\"', follow_char: '\"]'});
                                }
                            }
                        });
                    } else {
                        // For everything else, do nothing (no further selection possible)
                        // no-op
                    }
                }
            }
        }
        _autocompleteOptions = options;
    }

    function _renderAutocompleteDropdown(element, expectsType) {
        var inputString = $(element).val().substring(0, $(element).getCaretPosition());

        // Weird issue where the textarea box was putting in ASCII (nbsp) for spaces.
        inputString = inputString.replace(String.fromCharCode(160), ' ');

        _autocompleteFromDatasource(inputString, theFreeboardModel.datasources(), expectsType);

        if (_autocompleteOptions.length > 0) {
            if (!dropdown) {
                dropdown = $('<ul id="value-selector" class="value-dropdown"></ul>')
                    .insertAfter(element)
                    .width($(element).outerWidth() - 2)
                    .css('left', $(element).position().left)
                    .css('top', $(element).position().top + $(element).outerHeight() - 1);
            }

            dropdown.empty();
            dropdown.scrollTop(0);

            var selected = true;
            selectedOptionIndex = 0;

            _.each(_autocompleteOptions, function(option, index) {
                var li = _renderAutocompleteDropdownOption(element, inputString, option, index);
                if (selected) {
                    $(li).addClass('selected');
                    selected = false;
                }
            });
        } else {
            _checkCurrentValueType(element, expectsType);
            $(element).next('ul#value-selector').remove();
            dropdown = null;
            selectedOptionIndex = -1;
        }
    }

    function _renderAutocompleteDropdownOption(element, inputString, option, currentIndex) {
        var optionLabel = option.value;
        if(option.preview)
            optionLabel = optionLabel + '<span class="preview">' + option.preview + '</span>';

        var li = $('<li>' + optionLabel + '</li>').appendTo(dropdown)
            .mouseenter(function() {
                $(this).trigger('freeboard-select');
            })
            .mousedown(function(event) {
                $(this).trigger('freeboard-insertValue');
                event.preventDefault();
            })
            .data('freeboard-optionIndex', currentIndex)
            .data('freeboard-optionValue', option.value)
            .bind('freeboard-insertValue', function() {
                var optionValue = option.value;
                optionValue = option.precede_char + optionValue + option.follow_char;

                var replacementIndex = inputString.lastIndexOf(']');
                if(replacementIndex != -1)
                    $(element).replaceTextAt(replacementIndex+1, $(element).val().length, optionValue);
                else
                    $(element).insertAtCaret(optionValue);

                currentValue = option.entity;
                $(element).triggerHandler('mouseup');
            })
            .bind('freeboard-select', function() {
                $(this).parent().find('li.selected').removeClass('selected');
                $(this).addClass('selected');
                selectedOptionIndex = $(this).data('freeboard-optionIndex');
            });
        return li;
    }

    function createValueEditor(element, expectsType) {
        $(element).addClass('calculated-value-input')
            .bind('keyup mouseup freeboard-eval', function(event) {
                // Ignore arrow keys and enter keys
                if(dropdown && event.type === 'keyup' && (event.keyCode === 38 || event.keyCode === 40 || event.keyCode === 13)) {
                    event.preventDefault();
                    return;
                }
                _renderAutocompleteDropdown(element, expectsType);
            })
            .focus(function() {
                $(element).css({'z-index' : 3001});
                _resizeValueEditor(element);
            })
            .focusout(function() {
                _checkCurrentValueType(element, expectsType);
                $(element).css({
                    'height': '',
                    'z-index' : 3000
                });
                $(element).next('ul#value-selector').remove();
                dropdown = null;
                selectedOptionIndex = -1;
            })
            .bind('keydown', function(event) {
                if (dropdown) {
                    if (event.keyCode === 38 || event.keyCode === 40) {
                        // Handle Arrow keys
                        event.preventDefault();

                        var optionItems = $(dropdown).find('li');

                        if (event.keyCode === 38) // Up Arrow
                            selectedOptionIndex--;
                        else if(event.keyCode === 40) // Down Arrow
                            selectedOptionIndex++;

                        if (selectedOptionIndex < 0)
                            selectedOptionIndex = optionItems.size() - 1;
                        else if (selectedOptionIndex >= optionItems.size())
                            selectedOptionIndex = 0;

                        var optionElement = $(optionItems).eq(selectedOptionIndex);

                        optionElement.trigger('freeboard-select');
                        $(dropdown).scrollTop($(optionElement).position().top);

                    } else if (event.keyCode === 13) {
                        event.preventDefault();

                        if (selectedOptionIndex != -1) {
                            $(dropdown).find('li').eq(selectedOptionIndex)
                                .trigger('freeboard-insertValue');
                        }
                    }
                }
            });
    }

    // Public API
    return {
        createValueEditor : function(element, expectsType) {
            if(expectsType)
                createValueEditor(element, expectsType);
            else
                createValueEditor(element, EXPECTED_TYPE.ANY);
        },
        EXPECTED_TYPE : EXPECTED_TYPE
    };
};

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

function WidgetModel(theFreeboardModel, widgetPlugins) {
    'use strict';

    function disposeWidgetInstance() {
        if (!_.isUndefined(self.widgetInstance)) {
            if (_.isFunction(self.widgetInstance.onDispose)) {
                self.widgetInstance.onDispose();
            }
            self.widgetInstance = undefined;
        }
    }

    var self = this;

    this.datasourceRefreshNotifications = {};
    this.calculatedSettingScripts = {};
    this.scriptGlobalVariables = {};

    this.isEditing = ko.observable(false); // editing by PluginEditor
    this.title = ko.observable();
    this.fillSize = ko.observable(false);

    this.type = ko.observable();
    this.type.subscribe(function(newValue) {
        disposeWidgetInstance();

        if ((newValue in widgetPlugins) && _.isFunction(widgetPlugins[newValue].newInstance)) {
            var widgetType = widgetPlugins[newValue];

            var finishLoad = function() {
                widgetType.newInstance(self.settings(), function (widgetInstance) {
                    self.fillSize((widgetType.fill_size === true));
                    self.widgetInstance = widgetInstance;
                    self.shouldRender(true);
                    self._heightUpdate.valueHasMutated();
                });
            };

            // Do we need to load any external scripts?
            if (widgetType.external_scripts)
                head.js(widgetType.external_scripts.slice(0), finishLoad); // Need to clone the array because head.js adds some weird functions to it
            else
                finishLoad();
        }
    });

    this.settings = ko.observable({});
    this.settings.subscribe(function(newValue) {
        var updateCalculate = true;
        if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.onSettingsChanged))
            updateCalculate = self.widgetInstance.onSettingsChanged(newValue);

        if (_.isUndefined(updateCalculate) || updateCalculate === true)
            self.updateCalculatedSettings();
        self._heightUpdate.valueHasMutated();
    });

    this.processDatasourceUpdate = function(datasourceName) {
        var refreshSettingNames = self.datasourceRefreshNotifications[datasourceName];

        if (_.isArray(refreshSettingNames)) {
            _.each(refreshSettingNames, function(settingName) {
                self.processCalculatedSetting(settingName);
            });
        }
    };

    this.callValueFunction = function(theFunction, globalVariables) {
        return theFunction.call(undefined, theFreeboardModel.datasourceData, globalVariables);
    };

    this.processSizeChange = function() {
        if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.onSizeChanged))
            self.widgetInstance.onSizeChanged();
    };

    this.processCalculatedSetting = function(settingName) {
        if (_.isFunction(self.calculatedSettingScripts[settingName])) {
            var returnValue;

            try {
                returnValue = self.callValueFunction(self.calculatedSettingScripts[settingName], self.scriptGlobalVariables[settingName]);
            } catch (e) {
                var rawValue = self.settings()[settingName];

                // If there is a reference error and the value just contains letters and numbers, then
                if (e instanceof ReferenceError && (/^.*/).test(rawValue))
                    returnValue = rawValue;
                else if (e instanceof TypeError && e.message.indexOf('Cannot read property') != -1)
                    ;
            }

            if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.onCalculatedValueChanged) && !_.isUndefined(returnValue)) {
                try {
                    self.widgetInstance.onCalculatedValueChanged(settingName, returnValue);
                } catch (e) {
                    console.log(e.toString());
                }
            }
        }
    };

    this.updateDatasourceNameRef = function (newDatasourceName, oldDatasourceName) {
        if (_.isUndefined(self.type()))
            return;

        var settingsDefs = widgetPlugins[self.type()].settings;
        var oldRegex = new RegExp('datasources\\[[\'\"]' + _.escapeRegExp(oldDatasourceName) + '[\'\"]\\]', 'g');
        var rep = 'datasources[\"' + newDatasourceName + '\"]';
        var currentSettings = self.settings();

        _.each(settingsDefs, function (settingDef) {
            if (settingDef.type === 'calculated') {
                var script = currentSettings[settingDef.name];

                if (!_.isUndefined(script)) {
                    script = script.replace(oldRegex, rep);
                    currentSettings[settingDef.name] = script;
                    self.settings(currentSettings);
                }
            }
        });
    };

    this.updateCalculatedSettings = function () {
        self.datasourceRefreshNotifications = {};
        self.calculatedSettingScripts = {};

        if (_.isUndefined(self.type())) {
            return;
        }

        // Check for any calculated settings
        var settingsDefs = widgetPlugins[self.type()].settings;
        var datasourceRegex = new RegExp('datasources.([\\w_-]+)|datasources\\[[\'\"]([^\'\"]+)', 'g');
        var currentSettings = self.settings();

        _.each(settingsDefs, function (settingDef) {
            if (settingDef.type === 'calculated') {
                var script = currentSettings[settingDef.name];

                if (!_.isUndefined(script)) {

                    // clear global variable
                    self.scriptGlobalVariables[settingDef.name] = {};

                    if(_.isArray(script))
                        script = '[' + script.join(',') + ']';

                    // If there is no return, add one
                    if ((script.match(/;/g) || []).length <= 1 && script.indexOf('return') == -1)
                        script = 'return ' + script;

                    var valueFunction;

                    try {
                        valueFunction = new Function('datasources', '_global', script);
                    } catch (e) {
                        var literalText = currentSettings[settingDef.name].replace(/"/g, '\\"').replace(/[\r\n]/g, ' \\\n');

                        // If the value function cannot be created, then go ahead and treat it as literal text
                        valueFunction = new Function('datasources', '_global', 'return \"' + literalText + '\";');
                    }

                    self.calculatedSettingScripts[settingDef.name] = valueFunction;
                    self.processCalculatedSetting(settingDef.name);

                    // Are there any datasources we need to be subscribed to?
                    var matches;

                    while (matches = datasourceRegex.exec(script)) {
                        var dsName = (matches[1] || matches[2]);
                        var refreshSettingNames = self.datasourceRefreshNotifications[dsName];

                        if (_.isUndefined(refreshSettingNames)) {
                            refreshSettingNames = [];
                            self.datasourceRefreshNotifications[dsName] = refreshSettingNames;
                        }

                        // Only subscribe to this notification once.
                        if(_.indexOf(refreshSettingNames, settingDef.name) === -1)
                            refreshSettingNames.push(settingDef.name);
                    }
                }
            }
        });
    };

    this._heightUpdate = ko.observable();
    this.height = ko.computed({
        read: function () {
            self._heightUpdate();
            if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.getHeight)) {
                return self.widgetInstance.getHeight();
            }
            return 1;
        }
    });

    this.shouldRender = ko.observable(false);
    this.render = function (element) {
        self.shouldRender(false);
        if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.render)) {
            self.widgetInstance.render(element);
            self.updateCalculatedSettings();
        }
    };

    this.dispose = function () {
        if (!_.isUndefined(self.widgetInstance) && _.isFunction(self.widgetInstance.onDispose))
            self.widgetInstance.onDispose();
    };

    this.serialize = function () {
        return {
            title: self.title(),
            type: self.type(),
            settings: self.settings()
        };
    };

    this.deserialize = function (object) {
        self.title(object.title);
        self.settings(object.settings);
        self.type(object.type);
    };
}

// ┌────────────────────────────────────────────────┐ \\
// │ F R E E B O A R D                                                                              │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Copyright © 2013 Jim Heising (https://github.com/jheising)                                     │ \\
// │ Copyright © 2013 Bug Labs, Inc. (http://buglabs.net)                                           │ \\
// │ Copyright © 2015 Daisuke Tanaka (https://github.com/tanaka0323)                                │ \\
// ├────────────────────────────────────────────────┤ \\
// │ Licensed under the MIT license.                                                                │ \\
// └────────────────────────────────────────────────┘ \\

// Jquery plugin to watch for attribute changes
(function($)
{
    function isDOMAttrModifiedSupported() {
        var p = document.createElement('p');
        var flag = false;

        if(p.addEventListener) {
            p.addEventListener('DOMAttrModified', function() {
                flag = true;
            }, false);
        } else if(p.attachEvent) {
            p.attachEvent('onDOMAttrModified', function() {
                flag = true;
            });
        } else {
            return false;
        }

        p.setAttribute('id', 'target');
        return flag;
    }

    function checkAttributes(chkAttr, e) {
        if (chkAttr) {
            var attributes = this.data('attr-old-value');

            if(e.attributeName.indexOf('style') >= 0) {
                if(!attributes['style'])
                    attributes['style'] = {};

                //initialize
                var keys = e.attributeName.split('.');
                e.attributeName = keys[0];
                e.oldValue = attributes['style'][keys[1]]; //old value
                e.newValue = keys[1] + ':' + this.prop('style')[$.camelCase(keys[1])]; //new value
                attributes['style'][keys[1]] = e.newValue;
            }
            else
            {
                e.oldValue = attributes[e.attributeName];
                e.newValue = this.attr(e.attributeName);
                attributes[e.attributeName] = e.newValue;
            }

            this.data('attr-old-value', attributes); //update the old value object
        }
    }

    //initialize Mutation Observer
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    $.fn.attrchange = function(o) {

        var cfg = {
            trackValues: false,
            callback   : $.noop
        };

        // for backward compatibility
        if(typeof o === 'function')
            cfg.callback = o;
        else
            $.extend(cfg, o);

        // get attributes old value
        if(cfg.trackValues) {
            //get attributes old value
            $(this).each(function(j, el) {
                var attributes = {};
                for(var attr, i = 0, attrs = el.attributes, l = attrs.length; i < l; i++) {
                    attr = attrs.item(i);
                    attributes[attr.nodeName] = attr.value;
                }

                $(this).data('attr-old-value', attributes);
            });
        }

        // Modern Browsers supporting MutationObserver
        if (MutationObserver) {
            /*
             Mutation Observer is still new and not supported by all browsers.
             http://lists.w3.org/Archives/Public/public-webapps/2011JulSep/1622.html
             */
            var mOptions = {
                subtree          : false,
                attributes       : true,
                attributeOldValue: cfg.trackValues
            };

            var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(e) {
                    var _this = e.target;

                    //get new value if trackValues is true
                    if (cfg.trackValues) {
                        /**
                         * @KNOWN_ISSUE: The new value is buggy for STYLE attribute as we don't have
                         * any additional information on which style is getting updated.
                         * */
                        e.newValue = $(_this).attr(e.attributeName);
                    }

                    cfg.callback.call(_this, e);
                });
            });

            return this.each(function() {
                observer.observe(this, mOptions);
            });
        } else if(isDOMAttrModifiedSupported()) { //Opera
            //Good old Mutation Events but the performance is no good
            //http://hacks.mozilla.org/2012/05/dom-mutationobserver-reacting-to-dom-changes-without-killing-browser-performance/
            return this.on('DOMAttrModified', function(event) {
                if(event.originalEvent) {
                    event = event.originalEvent;
                } //jQuery normalization is not required for us
                event.attributeName = event.attrName; //property names to be consistent with MutationObserver
                event.oldValue = event.prevValue; //property names to be consistent with MutationObserver
                cfg.callback.call(this, event);
            });
        } else if('onpropertychange' in document.body) { //works only in IE
            return this.on('propertychange', function(e) {
                e.attributeName = window.event.propertyName;
                //to set the attr old value
                checkAttributes.call($(this), cfg.trackValues, e);
                cfg.callback.call(this, e);
            });
        }

        return this;
    };
})(jQuery);

(function(jQuery) {
    'use strict';

    jQuery.eventEmitter = {
        _JQInit: function() {
            this._JQ = jQuery(this);
        },
        emit: function(evt, data) {
            !this._JQ && this._JQInit();
            this._JQ.trigger(evt, data);
        },
        once: function(evt, handler) {
            !this._JQ && this._JQInit();
            this._JQ.one(evt, handler);
        },
        on: function(evt, handler) {
            !this._JQ && this._JQInit();
            this._JQ.bind(evt, handler);
        },
        off: function(evt, handler) {
            !this._JQ && this._JQInit();
            this._JQ.unbind(evt, handler);
        }
    };
}(jQuery));

var freeboard = (function() {
    'use strict';

    var datasourcePlugins = {};
    var widgetPlugins = {};

    var freeboardUI = new FreeboardUI();
    var theFreeboardModel = new FreeboardModel(datasourcePlugins, widgetPlugins, freeboardUI);

    var jsEditor = new JSEditor();
    var valueEditor = new ValueEditor(theFreeboardModel);
    var pluginEditor = new PluginEditor(jsEditor, valueEditor);

    var developerConsole = new DeveloperConsole(theFreeboardModel);

    ko.bindingHandlers.pluginEditor = {
        init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var options = ko.unwrap(valueAccessor());

            var types = {};
            var settings;
            var title = '';

            if (options.type == 'datasource') {
                types = datasourcePlugins;
                title = $.i18n.t('PluginEditor.datasource.title');
            } else if (options.type == 'widget') {
                types = widgetPlugins;
                title = $.i18n.t('PluginEditor.widget.title');
            } else if (options.type == 'pane') {
                title = $.i18n.t('PluginEditor.pane.title');
            }

            $(element).click(function(event) {
                if (options.operation == 'delete') {
                    var _title = $.i18n.t('PluginEditor.delete.title'),
                        _yes = $.i18n.t('global.yes'),
                        _no = $.i18n.t('global.no'),
                        _ask = $.i18n.t('PluginEditor.delete.text');

                    var phraseElement = $('<p>' + title + ' ' + _ask + ' ？</p>');
                    var db = new DialogBox(phraseElement, _title, _yes, _no, function(okcancel) {
                        if (okcancel == 'ok') {
                            if (options.type == 'datasource') {
                                theFreeboardModel.deleteDatasource(viewModel);
                            } else if (options.type == 'widget') {
                                theFreeboardModel.deleteWidget(viewModel);
                            } else if (options.type == 'pane') {
                                theFreeboardModel.deletePane(viewModel);
                            }
                        }
                    });
                } else {
                    var instanceType;

                    if (options.type === 'datasource') {
                        if(options.operation === 'add') {
                            settings = {};
                        } else {
                            instanceType = viewModel.type();
                            settings = viewModel.settings();
                            settings.name = viewModel.name();
                            viewModel.isEditing(true);
                        }
                    } else if(options.type === 'widget') {
                        if (options.operation === 'add') {
                            settings = {};
                        } else {
                            instanceType = viewModel.type();
                            settings = viewModel.settings();
                            viewModel.isEditing(true);
                        }
                    } else if (options.type === 'pane') {
                        settings = {};

                        if (options.operation === 'edit') {
                            settings.title = viewModel.title();
                            settings.col_width = viewModel.col_width();
                        }

                        types = {
                            settings: {
                                settings: [{
                                    name: "title",
                                    display_name: $.i18n.t('PluginEditor.pane.edit.title'),
                                    validate: "optional,maxSize[100]",
                                    type: "text",
                                    description: $.i18n.t('PluginEditor.pane.edit.title_desc')
                                }, {
                                    name: "col_width",
                                    display_name: $.i18n.t('PluginEditor.pane.edit.colwidth'),
                                    validate: "required,custom[integer],min[1],max[10]",
                                    style: "width:100px",
                                    type: "number",
                                    default_value: 1,
                                    description: $.i18n.t('PluginEditor.pane.edit.colwidth_desc')
                                }]
                            }
                        };
                    }

                    var saveSettingCallback = function(newSettings) {
                        if (options.operation === 'add') {
                            var newViewModel;
                            if (options.type === 'datasource') {
                                newViewModel = new DatasourceModel(theFreeboardModel, datasourcePlugins);
                                theFreeboardModel.addDatasource(newViewModel);

                                newViewModel.name(newSettings.settings.name);
                                delete newSettings.settings.name;

                                newViewModel.settings(newSettings.settings);
                                newViewModel.type(newSettings.type);
                            } else if (options.type === 'widget') {
                                newViewModel = new WidgetModel(theFreeboardModel, widgetPlugins);
                                newViewModel.settings(newSettings.settings);
                                newViewModel.type(newSettings.type);

                                viewModel.widgets.push(newViewModel);

                                freeboardUI.attachWidgetEditIcons(element);
                            }
                        } else if (options.operation === 'edit') {
                            if(options.type === 'pane') {
                                viewModel.title(newSettings.settings.title);
                                viewModel.col_width(newSettings.settings.col_width);
                                freeboardUI.processResize(false);
                            } else {
                                if(options.type === 'datasource') {
                                    if (viewModel.name() != newSettings.settings.name)
                                        theFreeboardModel.updateDatasourceNameRef(newSettings.settings.name, viewModel.name());
                                    viewModel.name(newSettings.settings.name);
                                    delete newSettings.settings.name;
                                }
                                viewModel.isEditing(false);
                                viewModel.type(newSettings.type);
                                viewModel.settings(newSettings.settings);
                            }
                        }
                    };

                    var cancelCallback = function() {
                        if (options.operation === 'edit') {
                            if (options.type === 'widget' || options.type === 'datasource')
                                viewModel.isEditing(false);
                        }
                    };

                    pluginEditor.createPluginEditor(title, types, instanceType, settings, saveSettingCallback, cancelCallback);
                }
            });
        }
    };

    ko.virtualElements.allowedBindings.datasourceTypeSettings = true;
    ko.bindingHandlers.datasourceTypeSettings = {
        update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            processPluginSettings(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
        }
    };

    ko.bindingHandlers.pane = {
        init  : function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            if (theFreeboardModel.isEditing())
                $(element).css({cursor: 'pointer'});

            freeboardUI.addPane(element, viewModel, bindingContext.$root.isEditing());
        },

        update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // If pane has been removed
            if (theFreeboardModel.panes.indexOf(viewModel) == -1)
                freeboardUI.removePane(element);
            freeboardUI.updatePane(element, viewModel);
        }
    };

    ko.bindingHandlers.widget = {
        init  : function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            if (theFreeboardModel.isEditing())
                freeboardUI.attachWidgetEditIcons($(element).parent());
        },

        update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            if (viewModel.shouldRender()) {
                $(element).empty();
                viewModel.render(element);
            }
        }
    };

    function getParameterByName(name) {
        name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'), results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    // DOM Ready
    $(function() {

        // browser check
        if (head.browser.ie && head.browser.version <= 9) {
            alert('This browser not supported');
            return;
        }

        // i18next initialize
        $('html').i18n();

        // Show the loading indicator when we first load
        freeboardUI.showLoadingIndicator(true);

        $(window).resize(_.debounce(function() {
            freeboardUI.processResize(true);
        }, 500));
    });

    // PUBLIC FUNCTIONS
    return {
        initialize          : function(allowEdit, finishedCallback) {

            // Check to see if we have a query param called load. If so, we should load that dashboard initially
            var freeboardLocation = getParameterByName('load');

            theFreeboardModel.allow_edit(allowEdit);

            ko.applyBindings(theFreeboardModel);

            theFreeboardModel.setEditing(allowEdit);

            if (freeboardLocation !== '') {
                $.ajax({
                    url    : freeboardLocation,
                    success: function(data) {
                        theFreeboardModel.loadDashboard(data);

                        if (_.isFunction(finishedCallback))
                            finishedCallback();
                    }
                });
            } else {
                freeboardUI.showLoadingIndicator(false);
                if (_.isFunction(finishedCallback))
                    finishedCallback();

                freeboard.emit('initialized');
            }
        },

        newDashboard        : function() {
            theFreeboardModel.loadDashboard({allow_edit: true});
        },

        loadDashboard       : function(configuration, callback) {
            theFreeboardModel.loadDashboard(configuration, callback);
        },

        serialize           : function() {
            return theFreeboardModel.serialize();
        },

        setEditing          : function(editing, animate) {
            theFreeboardModel.setEditing(editing, animate);
        },

        isEditing           : function() {
            return theFreeboardModel.isEditing();
        },

        loadDatasourcePlugin: function(plugin) {
            if (_.isUndefined(plugin.display_name) || plugin.display_name === '')
                plugin.display_name = plugin.type_name;

            // Datasource name must be unique
            window.freeboard.isUniqueDatasourceName = function(field, rules, i, options) {
                var res = _.find(theFreeboardModel.datasources(), function(datasource) {
                    // except itself
                    if (datasource.isEditing() === false)
                        return datasource.name() == field.val();
                });
                if (!_.isUndefined(res))
                    return options.allrules.alreadyusedname.alertText;
            };

            // Add a required setting called name to the beginning
            plugin.settings.unshift({
                name: 'name',
                display_name: $.i18n.t('PluginEditor.datasource.given_name'),
                validate: 'funcCall[freeboard.isUniqueDatasourceName],required,custom[illegalEscapeChar],maxSize[20]',
                type: 'text',
                description: $.i18n.t('PluginEditor.datasource.given_name_desc')
            });

            theFreeboardModel.addPluginSource(plugin.source);
            datasourcePlugins[plugin.type_name] = plugin;
            theFreeboardModel._datasourceTypes.valueHasMutated();
        },

        resize : function() {
            freeboardUI.processResize(true);
        },

        loadWidgetPlugin    : function(plugin) {
            if(_.isUndefined(plugin.display_name))
                plugin.display_name = plugin.type_name;

            theFreeboardModel.addPluginSource(plugin.source);
            widgetPlugins[plugin.type_name] = plugin;
            theFreeboardModel._widgetTypes.valueHasMutated();
        },

        // To be used if freeboard is going to load dynamic assets from a different root URL
        setAssetRoot        : function(assetRoot) {
            jsEditor.setAssetRoot(assetRoot);
        },

        addStyle            : function(selector, rules) {
            var styleString = selector + '{' + rules + '}';

            var styleElement = $('style#fb-styles');

            if(styleElement.length === 0) {
                styleElement = $('<style id="fb-styles" type="text/css"></style>');
                $('head').append(styleElement);
            }

            if(styleElement[0].styleSheet)
                styleElement[0].styleSheet.cssText += styleString;
            else
                styleElement.text(styleElement.text() + styleString);
        },

        showLoadingIndicator: function(show) {
            freeboardUI.showLoadingIndicator(show);
        },

        showDialog          : function(contentElement, title, okTitle, cancelTitle, okCallback) {
            var db = new DialogBox(contentElement, title, okTitle, cancelTitle, okCallback);
        },

        getDatasourceSettings : function(datasourceName) {
            var datasources = theFreeboardModel.datasources();

            // Find the datasource with the name specified
            var datasource = _.find(datasources, function(datasourceModel) {
                return (datasourceModel.name() === datasourceName);
            });

            if(datasource)
                return datasource.settings();
            else
                return null;
        },

        setDatasourceSettings : function(datasourceName, settings) {
            var datasources = theFreeboardModel.datasources();

            // Find the datasource with the name specified
            var datasource = _.find(datasources, function(datasourceModel){
                return (datasourceModel.name() === datasourceName);
            });

            if (!datasource) {
                console.log('Datasource not found');
                return;
            }

            var combinedSettings = _.defaults(settings, datasource.settings());
            datasource.settings(combinedSettings);
        },

        getStyleString      : function(name) {
            var returnString = '';

            _.each(currentStyle[name], function(value, name) {
                returnString = returnString + name + ':' + value + ';';
            });

            return returnString;
        },

        getStyleObject      : function(name) {
            return currentStyle[name];
        },

        showDeveloperConsole : function() {
            developerConsole.showDeveloperConsole();
        }
    };
}());

$.extend(freeboard, jQuery.eventEmitter);
