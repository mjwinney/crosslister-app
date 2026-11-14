// src/lib/server/reportPdf.ts
import PDFDocument from 'pdfkit';
import { formatMoney, formatSaleDate, type ReportLine, type ReportTotals } from '$lib/reports';

const ROW_HEIGHT = 16;
const TABLE_WIDTH = 540;
const COLUMNS = [
    { title: 'Date of sale', width: 70, align: 'left' as const },
    { title: 'Item', width: 170, align: 'left' as const },
    { title: 'Sales', width: 75, align: 'right' as const },
    { title: 'COGS', width: 75, align: 'right' as const },
    { title: 'eBay fees', width: 75, align: 'right' as const },
    { title: 'Shipping', width: 75, align: 'right' as const }
];

const POSHMARK_COLUMNS = [
    { title: 'Date of sale', width: 70, align: 'left' as const },
    { title: 'Item', width: 210, align: 'left' as const },
    { title: 'Sales', width: 85, align: 'right' as const },
    { title: 'COGS', width: 85, align: 'right' as const },
    { title: 'Poshmark fees', width: 90, align: 'right' as const }
];

export function renderReportPdf(
    title: string,
    lines: ReportLine[],
    totals: ReportTotals,
    timeZone: string,
    platform: 'eBay' | 'Poshmark' = 'eBay'
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const columns = platform === 'eBay' ? COLUMNS : POSHMARK_COLUMNS;
        const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const left = doc.page.margins.left;
        const bottomLimit = doc.page.height - doc.page.margins.bottom;
        let y = doc.page.margins.top;

        const drawCells = (cells: string[], style: { bold?: boolean; color?: string; background?: string }) => {
            if (style.background) {
                doc.rect(left, y, TABLE_WIDTH, ROW_HEIGHT).fill(style.background);
            }
            doc.fillColor(style.color ?? 'black')
                .font(style.bold ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(9);
            let x = left;
            columns.forEach((column, index) => {
                doc.text(cells[index], x + 4, y + 4, {
                    width: column.width - 8,
                    align: column.align,
                    lineBreak: false,
                    ellipsis: true
                });
                x += column.width;
            });
            y += ROW_HEIGHT;
        };

        const drawHeader = () => drawCells(columns.map((column) => column.title), { bold: true, background: '#e5e7eb' });

        const drawRow = (cells: string[], style: { bold?: boolean; color?: string; background?: string } = {}) => {
            if (y + ROW_HEIGHT > bottomLimit) {
                doc.addPage();
                y = doc.page.margins.top;
                drawHeader();
            }
            drawCells(cells, style);
        };

        doc.font('Helvetica-Bold').fontSize(16).fillColor('black').text(`${platform} Sales Report: ${title}`, left, y);
        y = doc.y + 6;
        doc.font('Helvetica').fontSize(9).fillColor('black')
            .text(`Generated ${new Date().toLocaleDateString('en-US')}`, left, y);
        y = doc.y + 4;
        if (totals.missingCogsCount > 0) {
            doc.fillColor('#b91c1c')
                .text(`${totals.missingCogsCount} item(s) have no purchase price (COGS) and are shown in red.`, left, y);
            y = doc.y + 4;
        }
        y += 8;

        drawHeader();
        for (const line of lines) {
            drawRow(
                [
                    formatSaleDate(line.soldTime, timeZone),
                    line.title,
                    formatMoney(line.sales),
                    line.missingCogs ? 'Missing' : formatMoney(line.cogs ?? 0),
                    formatMoney(line.fees),
                    ...(platform === 'eBay' ? [formatMoney(line.shipping)] : [])
                ],
                line.missingCogs ? { color: '#b91c1c', background: '#fee2e2' } : {}
            );
        }
        drawRow(
            [
                'Total',
                `${totals.count} item(s)`,
                formatMoney(totals.sales),
                formatMoney(totals.cogs),
                formatMoney(totals.fees),
                ...(platform === 'eBay' ? [formatMoney(totals.shipping)] : [])
            ],
            { bold: true, background: '#f3f4f6' }
        );

        doc.end();
    });
}
