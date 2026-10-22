/**
 * A picture section as printed in an A4 report (proposal Concept chapter,
 * completion report): Title → Picture(s) → Description, in that order. The
 * title, its meta line and the pictures form one block that a page break
 * never splits (pictures.css). Every picture carries its label burned into
 * the pixels ("Concept / Illustrative", or "Actual photo · date"); until the
 * burned copy is ready — or where no canvas exists — the same words are laid
 * over the picture, so the label is never missing.
 */

import './pictures.css';

import {
  IMAGE_ROLE_LABEL,
  imageLabel,
  layoutColumns,
  orderedImages,
  parseRichText,
  SECTION_STATUS_LABEL,
  shortDate,
  type PictureImage,
  type PictureSection,
} from '../pictureSection.ts';
import { useBurnedLabel } from './useBurnedLabel.ts';

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = parseRichText(text);
  if (!blocks.length) return null;
  return (
    <div className={className}>
      {blocks.map((b, i) =>
        b.kind === 'ul' ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j} dir="auto">
                {it}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} dir="auto">
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {l}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

function PrintImage({ section, image, lang, tagged }: { section: PictureSection; image: PictureImage; lang: 'en' | 'ar'; tagged: boolean }) {
  const label = imageLabel(section.kind, image, lang);
  const src = useBurnedLabel(image.dataUri, label);
  const alt = `${section.kind === 'concept' ? 'Concept, illustrative' : `${IMAGE_ROLE_LABEL[image.role]} photo`}: ${image.caption || section.title || 'picture'}`;
  return (
    <figure className="ps-figure">
      <div className="ps-img">
        <img src={src ?? image.dataUri} alt={alt} data-label-burned={src ? 'true' : 'false'} />
        {!src && (
          <span className="ps-label-overlay" data-testid="picture-label">
            {label}
          </span>
        )}
        {tagged && <span className={`ps-tag ps-tag-${image.role}`}>{IMAGE_ROLE_LABEL[image.role]}</span>}
      </div>
      {image.caption && <figcaption dir="auto">{image.caption}</figcaption>}
    </figure>
  );
}

export interface PictureSectionPrintProps {
  readonly section: PictureSection;
  /** The plate number printed before the title, e.g. "Concept 3" or "Item 2". */
  readonly figure: string;
  readonly lang?: 'en' | 'ar';
  readonly roomName?: string;
  /** Show the status and the done-on / by line (completion report). */
  readonly showWork?: boolean;
}

export function PictureSectionPrint({ section: s, figure, lang = 'en', roomName, showWork = false }: PictureSectionPrintProps) {
  const images = orderedImages(s);
  const cols = layoutColumns(s);
  const tagged = images.some((i) => i.role !== 'main');
  const meta = [roomName, s.scopeRef || s.scopeText ? [s.scopeRef && `BOQ ${s.scopeRef}`, s.scopeText].filter(Boolean).join(' — ') : ''].filter(Boolean);
  return (
    <section className="ps" data-status={s.status} aria-label={`${figure}: ${s.title || 'Untitled'}`}>
      <div className="ps-keep">
        <h3 className="ps-title" dir="auto">
          <span className="ps-fig">{figure}</span>
          <span>{s.title || 'Untitled'}</span>
          {showWork && <span className={`ps-status ps-status-${s.status}`}>{SECTION_STATUS_LABEL[s.status]}</span>}
        </h3>
        {meta.length > 0 && <p className="ps-meta">{meta.join(' · ')}</p>}
        {images.length > 0 ? (
          <div className={`ps-grid ps-cols-${cols}`}>
            {images.map((im) => (
              <PrintImage key={im.id} section={s} image={im} lang={lang} tagged={tagged} />
            ))}
          </div>
        ) : (
          <p className="ps-noimage">{s.kind === 'concept' ? 'Picture to follow.' : 'No photo yet.'}</p>
        )}
      </div>
      <RichText text={s.description} className="ps-desc" />
      {showWork && (s.doneOn || s.doneBy) && (
        <p className="ps-work">
          {s.doneOn && (
            <>
              <strong>{s.status === 'done' ? 'Completed' : 'Recorded'}:</strong> {shortDate(s.doneOn)}
            </>
          )}
          {s.doneOn && s.doneBy && ' · '}
          {s.doneBy && (
            <>
              <strong>By:</strong> {s.doneBy}
            </>
          )}
        </p>
      )}
      {s.signOff && (
        <div className="ps-signoff" aria-label="Client sign-off for this item">
          <span>Client accepts this item</span>
          <span className="ps-sigline">Signature</span>
          <span className="ps-sigline">Date</span>
        </div>
      )}
    </section>
  );
}

/**
 * The proposal's Concept chapter body (any service line): a one-line reminder
 * that the pictures are illustrative, then one plate per section.
 */
export function ConceptChapter({ sections, lang = 'en', roomName, intro }: { sections: readonly PictureSection[]; lang?: 'en' | 'ar'; roomName?: (id: string | null) => string; intro?: string }) {
  return (
    <>
      <p className="small muted">{intro ?? 'Concepts show the intended result. Every picture in this chapter is labelled “Concept / Illustrative”: it is for guidance only and is not contractual — the scope and the schedules are.'}</p>
      {sections.map((s, i) => (
        <PictureSectionPrint key={s.id} section={s} figure={`Concept ${i + 1}`} lang={lang} roomName={roomName?.(s.roomId) || undefined} />
      ))}
    </>
  );
}
