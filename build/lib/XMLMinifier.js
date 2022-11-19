/**
 * A tool to minify XML strings
 * This code was borrowed and adapted from vkbeautify xml
 * https://github.com/vkiryukhin/vkBeautify/blob/master/vkbeautify.js
 */
function XMLMinifier() {
  function createShiftArr(step) {
    let space = '    ';

    if (parseInt(step, 10).isNaN) {
      // argument is string
      space = step;
    } else {
      // argument is integer
      switch (step) {
        case 1:
          space = ' ';
          break;
        case 2:
          space = '  ';
          break;
        case 3:
          space = '   ';
          break;
        case 4:
          space = '    ';
          break;
        case 5:
          space = '     ';
          break;
        case 6:
          space = '      ';
          break;
        case 7:
          space = '       ';
          break;
        case 8:
          space = '        ';
          break;
        case 9:
          space = '         ';
          break;
        case 10:
          space = '          ';
          break;
        case 11:
          space = '           ';
          break;
        case 12:
          space = '            ';
          break;
        default:
          break;
      }
    }

    const shift = ['\n']; // array of shifts

    for (let ix = 0; ix < 100; ix++) {
      shift.push(shift[ix] + space);
    }

    return shift;
  }

  function xml(text, step = '\t') {
    const ar = text
      .replace(/>\s{0,}</g, '><')
      .replace(/</g, '~::~<')
      .replace(/\s*xmlns:/g, '~::~xmlns:')
      .replace(/\s*xmlns=/g, '~::~xmlns=')
      .split('~::~');
    const len = ar.length;
    let inComment = false;
    let deep = 0;
    let str = '';
    let ix = 0;
    const shift = createShiftArr(step);

    for (ix = 0; ix < len; ix++) {
      // start comment or <![CDATA[...]]> or <!DOCTYPE //
      if (ar[ix].search(/<!/) > -1) {
        str += shift[deep] + ar[ix];
        inComment = true;
        // end comment  or <![CDATA[...]]> //
        if (
          ar[ix].search(/-->/) > -1
                    || ar[ix].search(/\]>/) > -1
                    || ar[ix].search(/!DOCTYPE/) > -1
        ) {
          inComment = false;
        }
      } else if (ar[ix].search(/-->/) > -1 || ar[ix].search(/\]>/) > -1) { // end comment  or <![CDATA[...]]> //
        str += ar[ix];
        inComment = false;
      } else if ( // <elm></elm> //
        /^<\w/.exec(ar[ix - 1])
                && /^<\/\w/.exec(ar[ix])
                && /^<[\w:\-.,]+/.exec(ar[ix - 1])
                === /^<\/[\w:\-.,]+/.exec(ar[ix])[0].replace('/', '')
      ) {
        str += ar[ix];
        if (!inComment) deep--;
      } else if ( // <elm> //
        ar[ix].search(/<\w/) > -1
                && ar[ix].search(/<\//) === -1
                && ar[ix].search(/\/>/) === -1
      ) {
        str = !inComment ? (str += shift[deep++] + ar[ix]) : (str += ar[ix]);
      } else if (ar[ix].search(/<\w/) > -1 && ar[ix].search(/<\//) > -1) { // <elm>...</elm> //
        str = !inComment ? (str += shift[deep] + ar[ix]) : (str += ar[ix]);
      } else if (ar[ix].search(/<\//) > -1) { // </elm> //
        str = !inComment ? (str += shift[--deep] + ar[ix]) : (str += ar[ix]);
      } else if (ar[ix].search(/\/>/) > -1) { // <elm/> //
        str = !inComment ? (str += shift[deep] + ar[ix]) : (str += ar[ix]);
      } else if (ar[ix].search(/<\?/) > -1) { // <? xml ... ?> //
        str += shift[deep] + ar[ix];
      } else if (ar[ix].search(/xmlns:/) > -1 || ar[ix].search(/xmlns=/) > -1) { // xmlns //
        str += shift[deep] + ar[ix];
      } else {
        str += ar[ix];
      }
    }

    return str[0] === '\n' ? str.slice(1) : str;
  }

  function minifyXML(text, preserveComments) {
    const xmlStr = xml(text);

    return preserveComments
      ? xmlStr
      : xmlStr
        .replace(/[\r\n\t]/g, ' ')
        .replace(/<![ \r\n\t]*(--([^-]|[\r\n]|-[^-])*--[ \r\n\t]*)>/g, '')
        .replace(/[ \r\n\t]{1,}xmlns/g, ' xmlns')
        .replace(/>\s{0,}</g, '><')
        .trim();
  }

  return {
    /**
         * Minify a XML string
         *
         * @param {String} xmlStr
         * @param {Boolean} preserveComments
         */
    minify(xmlStr, preserveComments = false) {
      return minifyXML(xmlStr, preserveComments);
    },
  };
}

module.exports = {
  XMLMinifier,
};
