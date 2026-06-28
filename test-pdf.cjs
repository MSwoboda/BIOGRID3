const { jsPDF } = require('jspdf');
const fs = require('fs');
const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
doc.text("EVENT DATE", 50, 50);
fs.writeFileSync('test.pdf', Buffer.from(doc.output('arraybuffer')));
console.log("Done");
