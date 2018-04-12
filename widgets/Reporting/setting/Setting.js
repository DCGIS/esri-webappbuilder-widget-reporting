///////////////////////////////////////////////////////////////////////////
// Copyright © 2018 - 2018 North Point Geographic Solutions. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/on',
    'dojo/query',
    'dojo/_base/html',
    'dojo/_base/lang',
    'dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'esri/lang',
    'jimu/utils',
    'jimu/BaseWidgetSetting',
    './SingleFilterSetting',
    'jimu/LayerInfos/LayerInfos',
    'jimu/dijit/Message',
    'jimu/dijit/CheckBox',
    'jimu/dijit/LoadingShelter'
  ],
  function(on, query, html, lang, declare, _WidgetsInTemplateMixin, esriLang, jimuUtils, BaseWidgetSetting,
    SingleSetting, LayerInfos, Message) {

    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-reporting-setting',
      singleSetting: null,
      layerChooserSelect: null,
      layerInfosObj: null,

      postMixInProperties: function() {
        this.jimuNls = window.jimuNls;
        this.layerInfosObj = LayerInfos.getInstanceSync();
        this.noTaskNls = this.nls.noTasksTip;
        this.noTaskNls = esriLang.substitute({
          addLayer: "<span>" + this.nls.addLayer + "</span>"
        }, this.noTaskNls);
      },

      postCreate: function() {
        this.inherited(arguments);
        this.noTaskTip.innerHTML = this.noTaskNls;
        if (this.config) {
          this.setConfig(this.config);
        }
      },

      setConfig: function(config) {
        this.printTextBox.setValue(config.printService);
        this.fLineTextBox.setValue(config.headerFirstLine);
        this.sLineTextBox.setValue(config.headerSecondLine);
        // var firstTarget = null;
        if (config.layerId) {
          var target = this._createTarget();
          target.singleConfig = config;
          this._createSingleSetting(target, null);
        }
        this._updateNoQueryTip();
      },

      _onListContentClicked: function(event) {
        var target = event.target || event.srcElement;
        var itemDom = jimuUtils.getAncestorDom(target, function(dom) {
          return html.hasClass(dom, 'item');
        }, 3);
        if (!itemDom) {
          return;
        }
        if (html.hasClass(target, 'action')) {
          if (html.hasClass(target, 'up')) {
            if (itemDom.previousElementSibling) {
              html.place(itemDom, itemDom.previousElementSibling, 'before');
            }
          } else if (html.hasClass(target, 'down')) {
            if (itemDom.nextElementSibling) {
              html.place(itemDom, itemDom.nextElementSibling, 'after');
            }
          } else if (html.hasClass(target, 'delete')) {
            if (this.singleSetting && this.singleSetting.target === itemDom) {
              this.singleSetting.destroy();
              this.singleSetting = null;
            }
            html.destroy(itemDom);
            var filterItemDoms = query('.item', this.listContent);
            if (filterItemDoms.length > 0) {
              this._createSingleSetting(filterItemDoms[0]);
            }
            this._updateNoQueryTip();
            // show the add layer button again
            this.addButton.style.display = '';
          }
          return;
        }

        if (this.singleSetting) {
          if (this.singleSetting.target !== itemDom) {
            var singleConfig = this.singleSetting.getConfig();
            if (singleConfig) {
              this.singleSetting.destroy();
              this.singleSetting = null;
              this._createSingleSetting(itemDom);
            }
          }
        } else {
          this._createSingleSetting(itemDom);
        }
      },

      _onBtnAddItemClicked: function() {
        if (this.singleSetting) {
          var singleConfig = this.singleSetting.getConfig();
          if (singleConfig) {
            this.singleSetting.destroy();
            this.singleSetting = null;
          } else {
            return;
          }
        }

        var target = this._createTarget();
        this._createSingleSetting(target, null);
        this.addButton.style.display = 'none';
      },

      _createSingleSetting: function(target) {
        query('.item', this.listContent).removeClass('selected');
        if (this.singleSetting) {
          this.singleSetting.destroy();
        }
        this.singleSetting = null;
        this.singleSetting = new SingleSetting({
          map: this.map,
          nls: this.nls,
          target: target,
          folderUrl: this.folderUrl,
          layerInfosObj: this.layerInfosObj
        });
        this.singleSetting.placeAt(this.singleSettingContent);
        this.own(on(this.singleSetting, 'loading', lang.hitch(this, function() {
          this.shelter.show();
        })));
        this.own(on(this.singleSetting, 'unloading', lang.hitch(this, function() {
          this.shelter.hide();
        })));
        this.own(on(this.singleSetting, 'before-destroy', lang.hitch(this, function() {
          html.addClass(this.separator, 'not-visible');
        })));
        html.addClass(target, 'selected');
        if (target.singleConfig) {
          this.singleSetting.setConfig(target.singleConfig);
          this.addButton.style.display = 'none';
        } else {
          setTimeout(lang.hitch(this, function() {
            this.singleSetting.showLayerChooserPopup();
          }), 50);
        }
        html.removeClass(this.separator, 'not-visible');
        html.addClass(this.noTaskTip, 'not-visible');
      },

      _createTarget: function(name) {
        name = name || "";
        var target = html.create("div", {
          "class": "item",
          "innerHTML": '<div class="label jimu-ellipsis" title="' + name + '">' + name + '</div>' +
            '<div class="actions jimu-float-trailing">' +
            '<div class="delete action jimu-float-trailing"></div>' +
            '<div class="down action jimu-float-trailing"></div>' +
            '<div class="up action jimu-float-trailing"></div>' +
            '</div>'
        }, this.listContent);
        return target;
      },

      _updateNoQueryTip: function() {
        var itemDoms = query('.item', this.listContent);
        if (itemDoms.length > 0) {
          html.addClass(this.noTaskTip, 'not-visible');
        } else {
          html.removeClass(this.noTaskTip, 'not-visible');
        }
      },

      getConfig: function() {
        if (this.singleSetting) {
          var singleConfig = this.singleSetting.getConfig();
          if (!singleConfig) {
            return false;
          }
        }

        var targets = query('.item', this.listContent);
        var config = {
          pdfReportFields: []
        };
        config.printService = this.printTextBox.get('value');
        config.headerFirstLine = this.fLineTextBox.get('value');
        config.headerSecondLine = this.sLineTextBox.get('value');
        if (!config.printService || !config.headerFirstLine || !config.headerSecondLine) {
          this._showMessage(this.nls.setPrintTip);
          return false;
        }
        // check if the print text box is a url
        if (config.printService.includes('http') === false) {
          this._showMessage(this.nls.setPrintUrlTip);
          return false;
        }
        const layerConfig = targets[0].singleConfig;
        config.pdfReportFields = layerConfig.pdfReportFields;
        config.csvReportFields = layerConfig.csvReportFields;
        config.layerId = layerConfig.layerId;
        config.dateField = layerConfig.dateField;
        config.addressAuthorityField = layerConfig.addressAuthorityField;
        config.proposedField = layerConfig.proposedField;
        config.proposedQueryValue = layerConfig.proposedQueryValue;
        config.reportLogo = layerConfig.reportLogo;

        // TODO: consider making these configurable in the future
        // set default config options
        config.selectionSymbol = {
          "color": [0, 242, 255, 255],
          "size": 12,
          "angle": 0,
          "xoffset": 0,
          "yoffset": 0,
          "type": "esriSMS",
          "style": "esriSMSCircle"
        };
        config.graphicalsearchoptions = {
          "enableextentselect": true,
          "enablecircleselect": true,
          "enableellipseselect": true,
          "enablepolyselect": true,
          "enablefreehandpolyselect": true
        };
        // console.log('config ', config);
        return config;
      },

      _showMessage: function(msg) {
        new Message({
          message: msg
        });
      },

      destroy: function() {
        if (this.singleSetting) {
          this.singleSetting.destroy();
        }
        this.singleSetting = null;
        this.inherited(arguments);
      }
    });
  });