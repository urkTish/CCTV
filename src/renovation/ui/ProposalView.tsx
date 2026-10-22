/**
 * The renovation proposal: a white A4 document, print-ready, in the same
 * branding as the CCTV report (it reuses report.css, the running header, the
 * Draft watermark and the SignOff block with the company stamp).
 *
 *   Cover · Summary · Your new home (when reviewed) · Mood board · Concept
 *   (when there are concept sections) · Before and after · Survey findings ·
 *   Scope of work · Finishes and colour schedule · Bill of quantities ·
 *   Programme · Exclusions · Assumptions and notes · Warranty · Payment
 *   schedule · Terms, validity and the visuals disclaimer · Approval.
 *   Chapters are numbered as they print.
 */

import '../../report/report.css';
import './proposal.css';

import type { ReactNode } from 'react';

import { COMPANY_NAME, LOGO_INTRINSIC, LOGO_LIGHT_URL } from '../../brand.ts';
import { longDate } from '../../report/reportModel.ts';
import { SignOff } from '../../report/SignOff.tsx';
import { ConceptChapter } from '../../pictures/ui/PictureSectionPrint.tsx';
import { inkOn } from '../briefs.ts';
import { money, moneyRound } from '../format.ts';
import type { GalleryPair, ProposalModel } from '../proposal.ts';
import { num } from '../trace.ts';
import { Gantt } from './QuantitiesBoq.tsx';

function Section({ n, title, children, pageBreak = true }: { n: number; title: string; children: ReactNode; pageBreak?: boolean }) {
  return (
    <section className={`report-section ${pageBreak ? 'page-break' : ''}`} aria-labelledby={`rn-s${n}`}>
      <h2 id={`rn-s${n}`}>
        <span className="report-num">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Pair({ p, label, furniture }: { p: GalleryPair; label: string; furniture: string | null }) {
  return (
    <figure className="rn-pair">
      <div className="rn-pair-images">
        <div>
          <img src={p.before} alt={`Before: ${p.caption}`} />
          <span className="rn-tag">Before</span>
        </div>
        <div>
          <img src={p.after} alt={`After, illustrative: ${p.caption}`} />
          <span className="rn-tag rn-tag-after">After — illustrative</span>
        </div>
      </div>
      <figcaption>
        <strong>{p.caption}.</strong> {label}
        {furniture && ` ${furniture}.`}
      </figcaption>
    </figure>
  );
}

function Paragraphs({ text }: { text: string }) {
  // Light markdown: "# Heading" lines become sub-headings; blank lines separate paragraphs.
  const blocks: { kind: 'h' | 'p'; text: string }[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join('\n') });
    para = [];
  };
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (/^#{1,3}\s/.test(l)) {
      flush();
      blocks.push({ kind: 'h', text: l.replace(/^#{1,3}\s*/, '') });
    } else if (!l) flush();
    else para.push(l);
  }
  flush();
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === 'h' ? (
          <h3 key={i} dir="auto" style={{ marginTop: i ? '8pt' : 0 }}>
            {b.text}
          </h3>
        ) : (
          <p key={i} dir="auto">
            {b.text.split('\n').map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {l}
              </span>
            ))}
          </p>
        ),
      )}
    </>
  );
}

export function ProposalView({ model: m }: { model: ProposalModel }) {
  const status = m.final ? `Final${m.revision ? ` — Rev ${m.revision}` : ''}` : 'Draft — not for approval';
  const cur = m.currency;
  const priceLine = m.total === null ? 'To be priced' : m.firm ? moneyRound(m.total, cur) : m.range ? `${moneyRound(m.range.low, '')} – ${moneyRound(m.range.high, cur)}` : '—';
  let n = 0;
  const next = () => (n += 1);
  return (
    <article className="report rn-report" aria-label="Renovation proposal" data-status={m.final ? 'final' : 'draft'}>
      {!m.final && (
        <div className="report-watermark" aria-hidden="true">
          <span>DRAFT — NOT FOR APPROVAL</span>
        </div>
      )}
      <table className="report-frame" role="presentation">
        <thead>
          <tr>
            <td>
              <div className="report-running-header">
                <img src={LOGO_LIGHT_URL} alt={COMPANY_NAME} width={LOGO_INTRINSIC.width} height={LOGO_INTRINSIC.height} />
                <span>
                  Renovation proposal — {m.projectName} · {status}
                </span>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <section className="report-cover rn-cover" aria-label="Cover">
                <div>
                  {!m.final && <div className="report-draft-ribbon">DRAFT — NOT FOR APPROVAL</div>}
                  <img className="cover-logo" src={LOGO_LIGHT_URL} alt={COMPANY_NAME} width={LOGO_INTRINSIC.width} height={LOGO_INTRINSIC.height} />
                  <h1 className="cover-title">Renovation proposal</h1>
                  <p className="cover-project">{m.projectName}</p>
                  <div className="cover-band" />
                  {m.hero && (
                    <figure className="rn-hero">
                      <img src={m.hero.after} alt={`Illustrative visual: ${m.hero.caption}`} />
                      <figcaption>{m.illustrativeLabel}. Actual colours, materials and finishes may differ.</figcaption>
                    </figure>
                  )}
                </div>
                <dl>
                  <dt>Prepared for</dt>
                  <dd>
                    {m.clientName || '—'}
                    {m.clientContact && <span className="muted"> · {m.clientContact}</span>}
                  </dd>
                  {m.site && (
                    <>
                      <dt>Site</dt>
                      <dd>{m.site}</dd>
                    </>
                  )}
                  <dt>Prepared by</dt>
                  <dd>
                    {COMPANY_NAME}
                    {m.preparedBy.name && ` — ${m.preparedBy.name}`}
                    {m.preparedBy.title && <span className="muted">, {m.preparedBy.title}</span>}
                  </dd>
                  <dt>Date</dt>
                  <dd>{longDate(m.date)}</dd>
                  <dt>Status</dt>
                  <dd>{m.final ? `Final${m.revision ? `, revision ${m.revision}` : ''} — valid until ${longDate(m.validUntil)}` : 'Draft for discussion — preliminary until the site survey'}</dd>
                </dl>
              </section>

              <Section n={next()} title="Summary">
                <ul>
                  {m.summary.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <dl className="report-facts">
                  <div>
                    <dt>{m.firm ? 'Total incl. VAT' : 'Estimated range incl. VAT'}</dt>
                    <dd>{priceLine}</dd>
                  </div>
                  <div>
                    <dt>Duration</dt>
                    <dd>{m.durationDays ? `about ${num(m.durationDays, 1)} working days` : '—'}</dd>
                  </div>
                  <div>
                    <dt>Start</dt>
                    <dd>{m.startWindow}</dd>
                  </div>
                  <div>
                    <dt>Rooms</dt>
                    <dd>{m.rooms.length}</dd>
                  </div>
                </dl>
                {!m.firm && m.total !== null && <p className="rn-subject">Subject to survey: the range becomes a firm price once the engineer has measured every room on site.</p>}
              </Section>

              {m.narrative && (
                <Section n={next()} title="Your new home">
                  <Paragraphs text={m.narrative} />
                </Section>
              )}

              <Section n={next()} title="Mood board" pageBreak={!m.narrative}>
                <p className="muted">
                  {m.mood.title}
                  {m.mood.words && ` — ${m.mood.words}`}
                </p>
                {m.mood.palette.length ? (
                  <ul className="rn-chips">
                    {m.mood.palette.map((c) => (
                      <li key={c.code}>
                        <span className="rn-chip-field" style={{ background: c.hex, color: inkOn(c.hex) }} />
                        <span className="rn-chip-tab" style={{ borderTopColor: c.hex }}>
                          <strong>{c.code}</strong>
                          <span>{c.name}</span>
                          <span className="muted small">{c.where.join(', ')}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Colours to be confirmed.</p>
                )}
                {m.mood.materials.length > 0 && (
                  <p>
                    <strong>Materials: </strong>
                    {m.mood.materials.join('; ')}.
                  </p>
                )}
                <p className="small muted">Colour swatches are screen and print approximations of the codes above — please check the physical samples.</p>
              </Section>

              {m.concepts.length > 0 && (
                <Section n={next()} title="Concept">
                  <ConceptChapter sections={m.concepts} lang={m.lang} roomName={m.roomName} />
                </Section>
              )}

              <Section n={next()} title="Before and after">
                {m.rooms.map((r) => (
                  <div key={r.id} className="rn-room">
                    <h3>
                      {r.name}
                      {r.subtotal !== null && m.firm && <span className="muted"> · {money(r.subtotal, cur)} before contingency and VAT</span>}
                    </h3>
                    {r.pairs.length ? (
                      r.pairs.map((p) => <Pair key={p.after.slice(-40)} p={p} label={m.illustrativeLabel} furniture={m.furnitureCaption} />)
                    ) : (
                      <p className="muted small">No approved visual for this room yet.</p>
                    )}
                    {r.finishes.length > 0 && (
                      <p className="small">
                        <strong>Finishes: </strong>
                        {r.finishes.map((f) => `${f.surface.toLowerCase()} — ${f.product}${f.code !== '—' ? `, ${f.colourName} (${f.code})` : ''}`).join('; ')}.
                      </p>
                    )}
                  </div>
                ))}
              </Section>

              <Section n={next()} title="Survey findings">
                {m.findings.length ? (
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th scope="col">Room</th>
                        <th scope="col">Found</th>
                        <th scope="col">What we will do</th>
                        <th scope="col">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.findings.map((f, i) => (
                        <tr key={i}>
                          <td>{f.room}</td>
                          <td>{f.text}</td>
                          <td>{f.action}</td>
                          <td>{f.fixNow ? 'Included now' : 'Recommended — can wait'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">No defects recorded.</p>
                )}
                {m.safety.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '8pt' }}>Safety observations</h3>
                    <ul>
                      {m.safety.map((s) => (
                        <li key={s.text}>
                          {s.text}. <em>Action: {s.action}</em>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Section>

              <Section n={next()} title="Scope of work">
                {m.rooms
                  .filter((r) => r.scope.length)
                  .map((r) => (
                    <div key={r.id} className="rn-scope">
                      <h3>{r.name}</h3>
                      <ul>
                        {r.scope.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </Section>

              <Section n={next()} title="Finishes and colour schedule">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th scope="col">Ref</th>
                      <th scope="col">Room</th>
                      <th scope="col">Surface</th>
                      <th scope="col">Material / product</th>
                      <th scope="col">Colour</th>
                      <th scope="col">Finish · size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.schedule.map((r) => (
                      <tr key={r.ref}>
                        <td>{r.ref}</td>
                        <td>{r.room}</td>
                        <td>{r.surface}</td>
                        <td>{r.product}</td>
                        <td>
                          {r.hex && <span className="rn-dot" style={{ background: r.hex }} aria-hidden="true" />}
                          {r.code !== '—' ? `${r.colourName} (${r.code})` : r.colourName}
                        </td>
                        <td>{[r.finish, r.size].filter(Boolean).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section n={next()} title="Bill of quantities">
                {!m.firm && <p className="rn-subject">Estimated quantities from the information available. Unit rates are shown once the survey confirms them; the estimated range is {priceLine}.</p>}
                <table className="report-table rn-boq">
                  <thead>
                    <tr>
                      <th scope="col">Ref</th>
                      <th scope="col">Description</th>
                      <th scope="col" className="num">
                        Qty
                      </th>
                      {m.firm && (
                        <>
                          <th scope="col" className="num">
                            Rate ({cur})
                          </th>
                          <th scope="col" className="num">
                            Amount ({cur})
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  {m.boqByRoom.map((g) => (
                    <tbody key={g.id}>
                      <tr className="rn-group">
                        <th scope="rowgroup" colSpan={m.firm ? 4 : 3}>
                          {g.label}
                        </th>
                        {m.firm && <td className="num">{money(g.subtotal, '')}</td>}
                      </tr>
                      {g.lines.map((l) => (
                        <tr key={l.key}>
                          <td>{l.ref}</td>
                          <td>{l.description}</td>
                          <td className="num">
                            {num(l.quantity.value)} {l.unit}
                          </td>
                          {m.firm && (
                            <>
                              <td className="num">{money(l.rate, '')}</td>
                              <td className="num">{money(l.amount, '')}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  ))}
                  {m.firm && m.totals && (
                    <tfoot>
                      {(
                        [
                          ['Subtotal', m.totals.subtotal],
                          [`Contingency ${num(m.totals.contingencyPct)}%`, m.totals.contingency],
                          ['Total before VAT', m.totals.beforeVat],
                          [`VAT ${num(m.totals.vatPct)}%`, m.totals.vat],
                          ['Total including VAT', m.totals.total],
                        ] as const
                      ).map(([k, v]) => (
                        <tr key={k}>
                          <th scope="row" colSpan={4} className="num">
                            {k}
                          </th>
                          <td className="num">
                            <strong>{money(v, '')}</strong>
                          </td>
                        </tr>
                      ))}
                    </tfoot>
                  )}
                </table>
                <p className="small muted" style={{ marginTop: '6pt' }}>
                  The contract view of the same items, grouped by trade, is available on request. Quantities include wastage as set out in the assumptions.
                </p>
              </Section>

              <Section n={next()} title="Programme">
                {m.programme && m.programme.activities.length ? (
                  <>
                    <div className="rn-gantt">
                      <Gantt programme={m.programme} compact />
                    </div>
                    <p className="small muted">Working days from the start date. Occupied homes are worked room by room; hold times (tile adhesive before grouting) are included.</p>
                  </>
                ) : (
                  <p className="muted">The programme follows once the scope is specified.</p>
                )}
              </Section>

              <Section n={next()} title="Exclusions" pageBreak={false}>
                <ul>
                  {m.exclusions.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                  {m.furnitureCaption && <li>Furniture and décor shown in the visuals: {m.furnitureCaption.toLowerCase()}.</li>}
                </ul>
              </Section>

              <Section n={next()} title="Assumptions and notes">
                <ul className="small">
                  {m.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </Section>

              <Section n={next()} title="Warranty" pageBreak={false}>
                <Paragraphs text={m.warranty} />
              </Section>

              <Section n={next()} title="Payment schedule" pageBreak={false}>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th scope="col">Milestone</th>
                      <th scope="col">When</th>
                      <th scope="col" className="num">
                        %
                      </th>
                      <th scope="col" className="num">
                        Amount ({cur})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.payments.map((p) => (
                      <tr key={p.label}>
                        <td>{p.label}</td>
                        <td>{p.trigger}</td>
                        <td className="num">{num(p.percent)}</td>
                        <td className="num">{p.amount === null ? 'after survey' : money(p.amount, '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section n={next()} title="Terms, validity and visuals" pageBreak={false}>
                <Paragraphs text={m.terms} />
                <p>
                  <strong>Visuals. </strong>
                  {m.visualsDisclaimer} Every visual in this proposal is labelled “{m.illustrativeLabel}”.
                </p>
                <p>
                  <strong>Design changes. </strong>
                  {m.freeRounds} round{m.freeRounds === 1 ? '' : 's'} of changes to the visuals and finishes are included free of charge.
                </p>
                <p>
                  <strong>Validity. </strong>
                  {m.final ? `This proposal is valid for ${m.validityDays} days, until ${longDate(m.validUntil)}.` : 'This is a draft. Validity and a firm price are set when the proposal is issued as final.'}
                </p>
              </Section>

              <Section n={next()} title="Approval">
                <SignOff final={m.final} preparedBy={m.preparedBy} date={m.date} clientName={m.clientName} />
              </Section>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
