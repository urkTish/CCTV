/**
 * Published limits the phase-2 modules depend on, each with its source.
 *
 * Nothing here is tunable by the user except where it says so; a standard is a
 * standard. Engineering allowances (which ARE editable) live next to the module
 * that uses them and are flagged `isEstimate` there.
 */

// ---------------------------------------------------------------------------
// Structured cabling — ANSI/TIA-568 channel model
// ---------------------------------------------------------------------------

/**
 * ANSI/TIA-568 copper channel model. The standard itself is paywalled; the
 * figures are taken from Fluke Networks' knowledge base, which states them
 * against ANSI/TIA-568-C.2:
 *
 *   "The maximum permitted length of the permanent link is 90 meters."
 *   "For a Channel test, the typical limit is 100 m."
 *
 *   https://www.flukenetworks.com/knowledge-base/dtx-cableanalyzer/10-rule-length-dtx-cableanalyzer
 *   https://www.flukenetworks.com/blog/cabling-chronicles/channel-permanent-link-patch-cords-mptl-e2e-oh-my
 *
 * The permanent link is the fixed horizontal cable between the patch panel and
 * the outlet/camera; the channel adds the patch and equipment cords at both ends.
 * 100 m channel = 90 m permanent link + 10 m of cords in total.
 *
 * Verified 2026-10-05.
 */
export const TIA568 = {
  permanentLinkMaxMetres: 90,
  channelMaxMetres: 100,
  patchCordAllowanceMetres: 10,
  sourceUrl: 'https://www.flukenetworks.com/knowledge-base/dtx-cableanalyzer/10-rule-length-dtx-cableanalyzer',
  verifiedOn: '2026-10-05',
} as const;

// ---------------------------------------------------------------------------
// Hikvision long-range ("extend mode") PoE
// ---------------------------------------------------------------------------

/**
 * Hikvision's long-range PoE switches have an "extend" mode that trades link
 * speed for reach. The switch datasheets give the reach (up to 300 m) but not
 * the speed. The speed comes from the quick-start guide for the dedicated
 * long-range models (DS-3E0318P-E/M(B), DS-3E0326P-E/M(B)), table 1-3:
 *
 *   Standard: "network transmission of up to 100 m, and the speed rate of the
 *              port is 100 Mbps"
 *   Extend:   "network transmission of up to 300 m, and the speed rate of the
 *              port is 10 Mbps"
 *
 *   https://assets.hikvision.com/prd/public/all/doc/m000008110/UD11877B-B_0318-26P-EMB-100M-Long-Range-PoE-Switch_Quick-Start-Guide_V1.1_20190916.pdf
 *
 * Every switch datasheet also warns that long-range "performance may vary
 * depend on camera model or cable condition". For any other model the 10 Mbps
 * figure is applied as an estimate and flagged.
 *
 * Note the brief assumed 250 m; Hikvision publishes 300 m. The published figure
 * is used.
 *
 * Verified 2026-10-05.
 */
export const HIKVISION_EXTEND_MODE = {
  maxMetres: 300,
  linkSpeedMbps: 10,
  standardModeLinkSpeedMbps: 100,
  sourceUrl:
    'https://assets.hikvision.com/prd/public/all/doc/m000008110/UD11877B-B_0318-26P-EMB-100M-Long-Range-PoE-Switch_Quick-Start-Guide_V1.1_20190916.pdf',
  verifiedOn: '2026-10-05',
} as const;

// ---------------------------------------------------------------------------
// Drive capacity
// ---------------------------------------------------------------------------

/**
 * Drive manufacturers sell capacity in decimal units. Seagate's SkyHawk and
 * SkyHawk AI data sheets (DS2118, DS1960) and Western Digital's WD Purple product
 * brief all state that one terabyte equals one trillion bytes, and Seagate adds
 * that "some of the listed capacity is used for formatting and other functions,
 * and thus will not be available for data storage".
 *
 * Storage requirements in this tool are also computed in decimal bytes (from
 * bitrate in bits per second), so drive capacity and requirement are compared in
 * the same unit and no binary (TiB) conversion is applied.
 *
 * What is NOT published anywhere we could find is HOW MUCH formatting costs on a
 * Hikvision NVR. The default below is an engineering allowance, is editable, and
 * is flagged as an estimate wherever it touches a number.
 */
export const DECIMAL_BYTES_PER_TB = 1e12;
export const DRIVE_CAPACITY_SOURCE_URL =
  'https://www.seagate.com/www-content/datasheets/pdfs/skyhawk-ai-DS1960-10C-2008GB-en_GB.pdf';
export const DEFAULT_FORMATTING_OVERHEAD = 0.05;
export const FORMATTING_OVERHEAD_IS_ESTIMATE = true;

// ---------------------------------------------------------------------------
// CAT6 packaging
// ---------------------------------------------------------------------------

/**
 * Bulk CAT6 is sold in 1000 ft boxes — 304.8 m, universally rounded to 305 m on
 * metric packaging. A single configurable constant, as the brief requires.
 */
export const DEFAULT_CABLE_BOX_METRES = 305;
