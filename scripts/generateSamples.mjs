import fs from 'fs'
import path from 'path'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { ethers } from 'ethers'

async function createSamplePdf({
  fileName,
  stateName,
  documentType,
  plotId,
  granteeName,
  granteeAddress,
  description,
  geoCell,
  surveyPlanNo,
  termYears,
  commencementDate,
  accentColor = rgb(0.08, 0.38, 0.22), // Deep Green
}) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  // Outer decorative border
  page.drawRectangle({
    x: 25,
    y: 25,
    width: width - 50,
    height: height - 50,
    borderWidth: 2.5,
    borderColor: accentColor,
  })

  // Inner border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderWidth: 0.8,
    borderColor: rgb(0.65, 0.65, 0.65),
  })

  // Header Emblem Placeholder
  page.drawRectangle({
    x: width / 2 - 25,
    y: height - 85,
    width: 50,
    height: 35,
    color: rgb(0.94, 0.96, 0.95),
    borderColor: accentColor,
    borderWidth: 1,
  })
  page.drawText('SEAL', {
    x: width / 2 - 14,
    y: height - 68,
    size: 10,
    font: helveticaBold,
    color: accentColor,
  })

  // State & Title
  const stateTitle = `${stateName.toUpperCase()} GOVERNMENT OF NIGERIA`
  const stateTitleWidth = helveticaBold.widthOfTextAtSize(stateTitle, 13)
  page.drawText(stateTitle, {
    x: (width - stateTitleWidth) / 2,
    y: height - 110,
    size: 13,
    font: helveticaBold,
    color: rgb(0.1, 0.15, 0.12),
  })

  const deptTitle = 'DIRECTORATE OF LANDS & PHYSICAL PLANNING'
  const deptTitleWidth = helvetica.widthOfTextAtSize(deptTitle, 9)
  page.drawText(deptTitle, {
    x: (width - deptTitleWidth) / 2,
    y: height - 126,
    size: 9,
    font: helvetica,
    color: rgb(0.35, 0.4, 0.38),
  })

  const docTitle = documentType.toUpperCase()
  const docTitleWidth = timesRomanBold.widthOfTextAtSize(docTitle, 18)
  page.drawText(docTitle, {
    x: (width - docTitleWidth) / 2,
    y: height - 156,
    size: 18,
    font: timesRomanBold,
    color: accentColor,
  })

  // Plot Reference Ribbon
  page.drawRectangle({
    x: 45,
    y: height - 195,
    width: width - 90,
    height: 24,
    color: rgb(0.95, 0.97, 0.96),
    borderColor: rgb(0.8, 0.85, 0.82),
    borderWidth: 1,
  })
  page.drawText(`OFFICIAL CADAS-REF: ${plotId}`, {
    x: 60,
    y: height - 186,
    size: 10,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  page.drawText(`SURVEY PLAN: ${surveyPlanNo}`, {
    x: width - 230,
    y: height - 186,
    size: 10,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2),
  })

  // Preamble Text
  const preamble =
    `THIS IS TO CERTIFY that under the powers conferred by the Land Use Act, Cap L5 Laws of the Federation of Nigeria, ` +
    `the Governor has granted a statutory right of occupancy over the piece or parcel of land described herein to the grantee named hereunder.`

  let yOffset = height - 235
  page.drawText(preamble, {
    x: 50,
    y: yOffset,
    size: 9.5,
    font: helvetica,
    color: rgb(0.18, 0.2, 0.18),
    lineHeight: 14,
    maxWidth: width - 100,
  })

  // Details Table
  yOffset -= 65
  const tableX = 50
  const tableW = width - 100
  const rowH = 26

  const fields = [
    ['GRANTEE / RECORDED OWNER:', granteeName],
    ['GRANTEE WALLET / IDENTIFIER:', granteeAddress],
    ['PARCEL IDENTIFIER (PLOT ID):', plotId],
    ['DESCRIPTION & LOCALITY:', description],
    ['CADASTRAL GEO-COORDINATES:', geoCell],
    ['APPROVED TERM OF OCCUPANCY:', `${termYears} Years from ${commencementDate}`],
    ['SURVEY REFERENCE BEACON:', surveyPlanNo],
  ]

  fields.forEach(([label, val], idx) => {
    const curY = yOffset - idx * rowH
    page.drawRectangle({
      x: tableX,
      y: curY,
      width: tableW,
      height: rowH,
      color: idx % 2 === 0 ? rgb(0.98, 0.99, 0.98) : rgb(1, 1, 1),
      borderColor: rgb(0.88, 0.9, 0.88),
      borderWidth: 0.5,
    })
    page.drawText(label, {
      x: tableX + 8,
      y: curY + 8,
      size: 8,
      font: helveticaBold,
      color: rgb(0.25, 0.3, 0.28),
    })
    page.drawText(val, {
      x: tableX + 175,
      y: curY + 8,
      size: 8.5,
      font: helvetica,
      color: rgb(0.05, 0.05, 0.05),
    })
  })

  // Signatures Section
  const signY = yOffset - fields.length * rowH - 60
  page.drawLine({
    start: { x: 60, y: signY },
    end: { x: 230, y: signY },
    thickness: 1,
    color: rgb(0.3, 0.3, 0.3),
  })
  page.drawText('DIRECTOR OF DEEDS & SURVEYS', {
    x: 65,
    y: signY - 14,
    size: 8,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText('Bureau of Lands & Urban Development', {
    x: 65,
    y: signY - 26,
    size: 7.5,
    font: helveticaOblique,
    color: rgb(0.4, 0.4, 0.4),
  })

  page.drawLine({
    start: { x: width - 230, y: signY },
    end: { x: width - 60, y: signY },
    thickness: 1,
    color: rgb(0.3, 0.3, 0.3),
  })
  page.drawText('HON. COMMISSIONER / REGISTRAR', {
    x: width - 225,
    y: signY - 14,
    size: 8,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText('Ministry of Physical Planning', {
    x: width - 225,
    y: signY - 26,
    size: 7.5,
    font: helveticaOblique,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Security & Blockchain Verification Notice footer
  const footerY = 55
  page.drawRectangle({
    x: 45,
    y: footerY,
    width: width - 90,
    height: 48,
    color: rgb(0.96, 0.98, 0.97),
    borderColor: rgb(0.8, 0.88, 0.84),
    borderWidth: 0.8,
  })
  page.drawText('LANDVERIFY ON-CHAIN AUTHENTICATION STANDARD', {
    x: 55,
    y: footerY + 34,
    size: 8,
    font: helveticaBold,
    color: accentColor,
  })
  page.drawText(
    'This title document is cryptographically fingerprinted on BOT Chain Testnet (Chain ID 968). Any alteration of text, ' +
      'coordinates, or signature will invalidate its client-side keccak256 hash. Verify instantly on https://landverify.bohr.life',
    {
      x: 55,
      y: footerY + 20,
      size: 7,
      font: helvetica,
      color: rgb(0.3, 0.35, 0.32),
      lineHeight: 10,
      maxWidth: width - 110,
    }
  )

  const pdfBytes = await pdfDoc.save()
  const outDir = path.resolve('public', 'samples')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const outPath = path.join(outDir, fileName)
  fs.writeFileSync(outPath, pdfBytes)

  const docHash = ethers.keccak256(pdfBytes)
  console.log(`Generated: ${fileName} -> DocHash: ${docHash}`)
  return { fileName, docHash, outPath }
}

async function main() {
  console.log('Generating sample demo PDFs...')

  const sample1 = await createSamplePdf({
    fileName: 'LAG-IKJ-0421-CertificateOfOccupancy.pdf',
    stateName: 'Lagos State',
    documentType: 'Certificate of Occupancy',
    plotId: 'LAG-IKJ-0421',
    granteeName: 'Adekunle & Sons Commercial Holdings Ltd',
    granteeAddress: '0x1111111111111111111111111111111111111111',
    description: '1,250 sqm Commercial Plot, Ikeja GRA, Lagos State',
    geoCell: '6.5954, 3.3541',
    surveyPlanNo: 'LS/D/IKJ/2022/0421',
    termYears: 99,
    commencementDate: '1st January 2022',
    accentColor: rgb(0.08, 0.38, 0.22),
  })

  const sample2 = await createSamplePdf({
    fileName: 'ABJ-MAI-1188-RightOfOccupancy.pdf',
    stateName: 'Federal Capital Territory (Abuja)',
    documentType: 'Statutory Right of Occupancy',
    plotId: 'ABJ-MAI-1188',
    granteeName: 'Maitama Prime Estates & Residences Ltd',
    granteeAddress: '0x2222222222222222222222222222222222222222',
    description: '800 sqm Residential Plot, Maitama District, Abuja, FCT',
    geoCell: '9.0882, 7.4913',
    surveyPlanNo: 'AGIS/FCT/MAI/2023/1188',
    termYears: 99,
    commencementDate: '15th June 2023',
    accentColor: rgb(0.65, 0.45, 0.05), // Amber
  })

  const sample3 = await createSamplePdf({
    fileName: 'KAN-NAS-0089-DeedOfAssignment.pdf',
    stateName: 'Kano State',
    documentType: 'Deed of Assignment & Conveyance',
    plotId: 'KAN-NAS-0089',
    granteeName: 'Northern Agro-Industrial Warehousing Consortium',
    granteeAddress: '0x3333333333333333333333333333333333333333',
    description: '2,500 sqm Industrial Parcel, Nassarawa GRA, Kano State',
    geoCell: '12.0022, 8.5919',
    surveyPlanNo: 'KAN/NAS/IND/2021/0089',
    termYears: 50,
    commencementDate: '1st September 2021',
    accentColor: rgb(0.6, 0.15, 0.15), // Crimson
  })

  const manifest = {
    generatedAt: new Date().toISOString(),
    samples: [sample1, sample2, sample3],
  }
  fs.writeFileSync(
    path.resolve('public', 'samples', 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )
  console.log('Sample generation complete. Manifest saved.')
}

main().catch(console.error)
