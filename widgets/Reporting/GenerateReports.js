// Class for handing report printing
define([
  'dojo/_base/declare',
  'dojo/_base/array',
  'dojo/Deferred',
  './libs/pdfmake_vsf_fonts.min'
], function(
  declare, array, Deferred) {
  return declare(null, {

    //map: null,
    config: null,

    constructor: function(options) {
      this.config = options.config; // the config file
    },

    generateReport: function(features, logo, comments, mapPrint, reportName) {
      let deferred = new Deferred();
      var widget = this;
      let mapImage = {};
      let shouldBreak = '';
      // logic to include a map or not
      if (mapPrint != null) { // jshint ignore:line
        mapImage = {
          image: mapPrint,
          width: 675,
          alignment: 'center'
        };
        shouldBreak = 'after';
      }
      const headers = [];
      const widths = [];
      array.forEach(this.config.pdfReportFields, function(fieldInfo) {
        headers.push(fieldInfo.header);
        widths.push(fieldInfo.width);
      }, this);

      var docDefinition = {
        pageOrientation: 'landscape',
        pageMargins: [18, 50, 18, 40],
        footer: function(currentPage, pageCount) {
          return {
            text: currentPage.toString() + ' of ' + pageCount,
            alignment: 'center'
          };
        },
        header: widget._formatHeader(logo),
        content: [{
            table: {
              headerRows: 1,
              dontBreakRows: true,
              widths: widths,
              body: widget._constructTable(headers, features)
            }
          },
          {
            text: 'COMMENTS: ' + comments,
            margin: [0, 10, 0, 0],
            pageBreak: shouldBreak
          },
          mapImage
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true
          },
          subheader: {
            fontSize: 15,
            bold: true
          },
          quote: {
            italics: true
          },
          small: {
            fontSize: 8
          },
          tableHeaderOverview: {
            bold: true,
            fontSize: 12,
            color: 'white',
            fillColor: '#4c4c4c'
          }
        }
      };
      pdfMake.createPdf(docDefinition).download(reportName + '.pdf', function() { // jshint ignore:line
        deferred.resolve();
      });
      return deferred.promise;
    },

    _formatHeader(logo) {
      let logoPlaceHolder = {
        text: '',
        margin: 2,
        width: 34
      };
      if (logo) {
        logoPlaceHolder = {
          image: logo,
          width: 34
        };
      }
      return {
        margin: [20, 8, 20, 8],
        columns: [{
          table: {
            widths: ['20%', '60%', '20%'],
            body: [
              [logoPlaceHolder,
                {
                  text: [{
                    text: this.config.headerFirstLine + '\n'
                  }, {
                    text: this.config.headerSecondLine
                  }],
                  alignment: 'center'
                }, {
                  text: '',
                  alignment: 'right'
                }
              ]
            ]
          },
          layout: 'noBorders'
        }]
      };
    },

    _constructTable: function(headers, addresses) {
      const self = this;
      let body = [];
      let headerText = [];
      for (var z = 0; z < headers.length; z++) {
        headerText.push({
          text: headers[z],
          style: 'tableHeaderOverview'
        });
      }
      body.push(headerText);
      for (var i = 0; i < addresses.length; i++) {
        let row = [];
        array.forEach(this.config.pdfReportFields, function(field) { // jshint ignore:line
          if (field.type === 'string') {
            row.push(addresses[i].attributes[field.fieldName] !== null ? addresses[i].attributes[field.fieldName].toString() : '');
          } else if (field.type === 'date') {
            row.push(addresses[i].attributes[field.fieldName] !== null ? self._formatDate(addresses[i].attributes[field.fieldName]) : '');
          }
        }, self);
        body.push(row);
      }
      return body;
    },

    err: function(err) {
      console.log('Failed to print report: ', err);
    },

    _formatDate(dateNum) {
      let theDate = new Date(dateNum);
      let adjustedDate = new Date(theDate.getTime() + theDate.getTimezoneOffset() * 60000);
      return (adjustedDate.getMonth() + 1) + '/' + adjustedDate.getDate() + '/' + adjustedDate.getFullYear();
    },

    convertImage(imgUrl) {
      let deferred = new Deferred();
      if (imgUrl.indexOf('${appPath}/') === 0) {
        imgUrl = imgUrl.substring(11);
      }
      this.checkImage(imgUrl,
        function() {
          let canvas = document.createElement('CANVAS');
          let ctx = canvas.getContext('2d');
          let dataURL;
          canvas.height = this.height;
          canvas.width = this.width;
          ctx.drawImage(this, 0, 0);
          dataURL = canvas.toDataURL('image/jpeg', 1.0);
          canvas = null;
          deferred.resolve(dataURL);
        },
        function(blah) {
          console.log('no image', blah);
          deferred.resolve(null);
        });

      return deferred.promise;
    },

    checkImage(imageSrc, good, bad) {
      var img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageSrc;
      img.onload = good;
      img.onerror = bad;
    }

    // testImage(url, timeoutT) {
    //   return new Promise(function(resolve, reject) {
    //     var timeout = timeoutT || 5000;
    //     var timer, img = new Image();
    //     img.onerror = img.onabort = function() {
    //       clearTimeout(timer);
    //       reject("error");
    //     };
    //     img.onload = function() {
    //       clearTimeout(timer);
    //       resolve("success");
    //     };
    //     timer = setTimeout(function() {
    //       // reset .src to invalid URL so it stops previous
    //       // loading, but doens't trigger new load
    //       img.src = "//!!!!/noexist.jpg";
    //       reject("timeout");
    //     }, timeout);
    //     img.src = url;
    //   });
    // }
  });
});