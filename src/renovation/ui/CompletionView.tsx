/**
 * The completion / photo report: a white A4 document in the same template
 * family as the CCTV report and the renovation proposal (report.css, running
 * header, Draft watermark, SignOff with the company stamp on Final only).
 *
 *   Cover · Project summary · Completed works (one picture section per item:
 *   before / during / after, date, who did it, status) · Outstanding snags ·
 *   Not yet complete (drafts only) · Client acceptance
 */

import '../../report/report.css';
import './proposal.css';

import type { ReactNode } from 'react';

import { COMPANY_NAME, LOGO_INTRINSIC, LOGO_LIGHT_URL } from '../../brand.ts';
import { PictureSectionPrint, RichText } from '../../pictures/ui/PictureSectionPrint.tsx';
import { SECTION_STATUS_LABEL, type PictureSection } from '../../pictures/pictureSection.ts';
import { longDate } from '../../report/reportModel.ts';
import { SignOff } from '../../report/SignOff.tsx';
import type { CompletionModel } from '../completion.ts';

function Section({ n, title, children, pageBreak = true }: { n: number; title: string; children: ReactNode; pageBreak?: boolean }) {
  return (
    <section className={`report-section ${pageBreak ? 'page-break' : ''}`} aria-labelledby={`cr-s${n}`}>
      <h2 id={`cr-s${n}`}>
        <span className="report-num">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CompletionView({ model: m, items }: { model: CompletionModel; items: readonly PictureSection[] }) {
  const status = m.final ? `Final${m.revision ? ` — Rev ${m.revision}` : ''}` : 'Draft — not for approval';
  const fig = (s: PictureSection) => `Item ${items.indexOf(s) + 1}`;
  let n = 0;
  const next = () => (n += 1);
  return (
    <article className="report rn-report cr-report" aria-label="Completion report" data-status={m.final ? 'final' : 'draft'}>
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
                  Completion report — {m.projectName} · {status}
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
                  <h1 className="cover-title">Completion report</h1>
                  <p className="cover-project">{m.projectName}</p>
                  <div className="cover-band" />
                  {m.hero && (
                    <figure className="rn-hero">
                      <img src={m.hero.src} alt={`After, actual photo: ${m.hero.caption}`} />
                      <figcaption>Actual photo after the works — {m.hero.caption}.</figcaption>
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
                  <dd>{m.final ? `Final${m.revision ? `, revision ${m.revision}` : ''}` : 'Draft for review — not yet accepted'}</dd>
                </dl>
              </section>

              <Section n={next()} title="Project summary">
                <dl className="report-facts">
                  {m.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
                {m.summary && <RichText text={m.summary} />}
                <p className="small muted">
                  Each item below shows the work as Title, then the photos, then a description. Every photo is an actual photo, labelled with the date it was taken; before photos are those taken at the survey.
                </p>
              </Section>

              <Section n={next()} title="Completed works" pageBreak={false}>
                {m.done.length ? m.done.map((s) => <PictureSectionPrint key={s.id} section={s} figure={fig(s)} lang={m.lang} roomName={m.roomName(s.roomId) || undefined} showWork />) : <p className="muted">No item is marked done yet.</p>}
              </Section>

              <Section n={next()} title="Outstanding snags">
                {m.snags.length ? (
                  <>
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th scope="col">Item</th>
                          <th scope="col">Room</th>
                          <th scope="col">What is outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.snags.map((s) => (
                          <tr key={s.id}>
                            <td>
                              {fig(s)} — {s.title || 'Untitled'}
                            </td>
                            <td>{m.roomName(s.roomId) || '—'}</td>
                            <td>{s.description.split('\n').find((l) => l.trim())?.replace(/^\s*[-•*]\s+/, '') ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {m.snags.map((s) => (
                      <PictureSectionPrint key={s.id} section={s} figure={fig(s)} lang={m.lang} roomName={m.roomName(s.roomId) || undefined} showWork />
                    ))}
                  </>
                ) : (
                  <p>No snags are outstanding.</p>
                )}
              </Section>

              {m.open.length > 0 && (
                <Section n={next()} title="Not yet complete" pageBreak={false}>
                  <ul>
                    {m.open.map((s) => (
                      <li key={s.id}>
                        {fig(s)} — {s.title || 'Untitled'}: {SECTION_STATUS_LABEL[s.status].toLowerCase()}.
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section n={next()} title="Client acceptance">
                <p>
                  The client confirms that the works listed under “Completed works” have been carried out{m.snags.length ? `, subject to the ${m.snags.length} outstanding snag${m.snags.length === 1 ? '' : 's'} listed, which ${COMPANY_NAME} will close` : ''}.
                </p>
                <SignOff final={m.final} preparedBy={m.preparedBy} date={m.date} clientName={m.clientName} />
              </Section>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
