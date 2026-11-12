import { Film } from '@/features/film';
import { InstallCommand } from '@/features/install-command';
import { Stream } from '@/features/stream';
import { LANDING, SITE } from '@/shared/config';
import { rich } from '@/shared/lib/rich';
import './Hero.css';

/** The landing, one screen: what the product is on the left, a real run of it on the right. */
export function Hero() {
  const { title, lede, under, film, stream } = LANDING.hero;
  return (
    <section className="hero wrap">
      <div className="hero-copy">
        <h1>
          {title.chip && (
            <>
              <span className="hero-lead">
                <span className="hero-chip">{title.chip}</span>
                {title.after}
              </span>{' '}
            </>
          )}
          {title.rest}
        </h1>
        <p className="lede">{rich(lede)}</p>
        <InstallCommand tabs={SITE.install} />
        <p className="hero-under">{rich(under)}</p>
      </div>
      {stream ? (
        <figure className="hero-demo">
          <Stream text={stream.text} label={stream.label} />
        </figure>
      ) : (
        film && (
          <figure className="hero-demo">
            <Film src={film.src} label={film.label} />
          </figure>
        )
      )}
    </section>
  );
}
