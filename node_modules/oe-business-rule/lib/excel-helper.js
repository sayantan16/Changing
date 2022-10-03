const XLSX = require('xlsx');
module.exports = {
  generateExcelBuffer(jsonDesc) {
    let { name, contextArray, inputExpressionList, outputs, hitPolicy, ruleList } = jsonDesc;
    let aoa = [];

    // decision name
    aoa.push([name]);

    // context
    contextArray.forEach(({ key, value }) => {
      aoa.push([key, value]);
    });

    // table header - inputs
    let inputsList = inputExpressionList.reduce((carrier, item) => {
      carrier.row1.push('Condition');
      carrier.row2.push(item.expr);
      carrier.row3.push(item.values);
      if (!carrier.row3HasValues) {
        carrier.row3HasValues = !!item.values;
      }
      return carrier;
    }, { row1: [], row2: [], row3: [], row3HasValues: false });

    // table header - outputs
    let collatedHeadersList = outputs.reduce((carrier, item) => {
      carrier.row1.push('Action');
      carrier.row2.push(item.expr);
      carrier.row3.push(item.values);
      if (!carrier.row3HasValues) {
        carrier.row3HasValues = !!item.values;
      }
      return carrier;
    }, { ...inputsList });

    // writing table header
    aoa.push(['RuleTable', ...collatedHeadersList.row1]);
    aoa.push([ hitPolicy, ...collatedHeadersList.row2 ]);
    if (collatedHeadersList.row3HasValues) {
      aoa.push(['', ...collatedHeadersList.row3]);
    }

    // table rules list
    ruleList.forEach((ruleRow, idx) => {
      aoa.push([ idx + 1, ...ruleRow]);
    });

    // create the workbook and worksheet
    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name);

    return XLSX.write(wb, { type: 'buffer'});
  }
};
