import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { APP_DOWNLOAD_FALLBACK_URL, resolveAppDownload } from '../utils/appDownload';
import '../styles/MainPage.scss';

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10 3v9m0 0 4-4m-4 4L6 8M4 16h12" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="m5 10 3 3 7-7" />
  </svg>
);

const MainPage = () => {
  const [preparingDownload, setPreparingDownload] = useState(false);

  const downloadApp = async () => {
    if (preparingDownload) return;
    setPreparingDownload(true);
    try {
      const download = await resolveAppDownload();
      window.location.assign(download.url);
    } catch {
      window.location.assign(APP_DOWNLOAD_FALLBACK_URL);
    } finally {
      setPreparingDownload(false);
    }
  };

  return (
    <div className="main-page">
      <header className="landing-header">
        <nav className="landing-shell landing-nav" aria-label="Main navigation">
          <Link to="/" className="landing-brand" aria-label="Intezo home">
            <img src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
            <span>Intezo</span>
          </Link>

          <div className="landing-nav__links">
            <a href="#how-it-works">How it works</a>
            <Link to="/doctor/login">Doctor login</Link>
            <Link to="/clinic/login" className="landing-nav__button">
              Clinic login
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-shell landing-hero__grid">
            <div className="landing-hero__copy">
              <p className="landing-eyebrow">
                <span />
                Queue management for modern care
              </p>
              <h1>
                Less waiting.
                <span>More caring.</span>
              </h1>
              <p className="landing-hero__lead">
                Intezo gives patients a clear place in line and gives clinic teams
                one calm, real-time view of every queue.
              </p>

              <div className="landing-hero__actions">
                <Link to="/clinic/register" className="landing-button landing-button--primary">
                  Start for your clinic
                  <ArrowIcon />
                </Link>
                <button
                  type="button"
                  onClick={downloadApp}
                  className="landing-button landing-button--secondary"
                  disabled={preparingDownload}
                >
                  <DownloadIcon />
                  {preparingDownload ? 'Preparing app…' : 'Get the patient app'}
                </button>
              </div>

              <ul className="landing-proof" aria-label="Product highlights">
                <li><CheckIcon /> Live queue visibility</li>
                <li><CheckIcon /> Simple clinic setup</li>
                <li><CheckIcon /> Mobile and web</li>
              </ul>
            </div>

            <div className="queue-visual" aria-label="Preview of the Intezo queue dashboard">
              <div className="queue-window">
                <div className="queue-window__header">
                  <div className="queue-window__brand">
                    <img src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
                    <span>Intezo</span>
                  </div>
                  <div className="queue-window__date">Today, 09:42</div>
                </div>

                <div className="queue-window__title">
                  <div>
                    <span>Family Care Clinic</span>
                    <h2>Current queue</h2>
                  </div>
                  <span className="live-badge"><i /> Live</span>
                </div>

                <div className="now-serving">
                  <div>
                    <span className="now-serving__label">Now serving</span>
                    <strong>Q-024</strong>
                    <span className="now-serving__room">Consultation room 02</span>
                  </div>
                  <div className="queue-ring">
                    <span>18</span>
                    <small>waiting</small>
                  </div>
                </div>

                <div className="queue-line">
                  <div className="queue-line__heading">
                    <span>Up next</span>
                    <span>Estimated wait</span>
                  </div>
                  <div className="queue-patient">
                    <span className="queue-token">Q-025</span>
                    <span>General consultation</span>
                    <strong>8 min</strong>
                  </div>
                  <div className="queue-patient">
                    <span className="queue-token queue-token--muted">Q-026</span>
                    <span>General consultation</span>
                    <strong>14 min</strong>
                  </div>
                </div>

                <div className="queue-window__footer">
                  <div><strong>4</strong><span>Doctors online</span></div>
                  <div><strong>18m</strong><span>Average wait</span></div>
                  <div><strong>42</strong><span>Seen today</span></div>
                </div>
              </div>

              <div className="queue-update">
                <span><CheckIcon /></span>
                <div>
                  <strong>Queue updated</strong>
                  <small>Everyone sees it instantly</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="portal-section" id="portals">
          <div className="landing-shell">
            <div className="section-heading">
              <p className="landing-kicker">Your workspace</p>
              <h2>One platform. The right view for every role.</h2>
              <p>Go straight to the tools made for the way you work.</p>
            </div>

            <div className="portal-grid">
              <article className="portal-card portal-card--featured">
                <span className="portal-card__number">01</span>
                <div>
                  <p className="portal-card__label">For clinics</p>
                  <h3>Run your day without the queue chaos.</h3>
                  <p>Manage doctors, patients and live queues from one focused dashboard.</p>
                </div>
                <div className="portal-card__actions">
                  <Link to="/clinic/login">Clinic login <ArrowIcon /></Link>
                  <Link to="/clinic/register">Register a clinic</Link>
                </div>
              </article>

              <article className="portal-card">
                <span className="portal-card__number">02</span>
                <div>
                  <p className="portal-card__label">For doctors</p>
                  <h3>See the next patient, not the noise.</h3>
                  <p>Move through assigned queues with the information you need in the moment.</p>
                </div>
                <div className="portal-card__actions">
                  <Link to="/doctor/login">Doctor login <ArrowIcon /></Link>
                  <Link to="/doctor/register">Register as a doctor</Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="workflow-section" id="how-it-works">
          <div className="landing-shell">
            <div className="section-heading section-heading--left">
              <p className="landing-kicker">How it works</p>
              <h2>A better queue in three simple steps.</h2>
            </div>

            <div className="workflow-grid">
              <article>
                <span>01</span>
                <h3>Set up the clinic</h3>
                <p>Add doctors, services and operating hours from the clinic portal.</p>
              </article>
              <article>
                <span>02</span>
                <h3>Patients join remotely</h3>
                <p>Patients find a clinic, book a place and follow their queue from the app.</p>
              </article>
              <article>
                <span>03</span>
                <h3>Serve with clarity</h3>
                <p>Call the next patient while every connected screen updates in real time.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="patient-app-section">
          <div className="landing-shell patient-app-card">
            <div className="patient-app-card__copy">
              <p className="landing-kicker">For patients</p>
              <h2>Your place in line, always in sight.</h2>
              <p>
                Discover clinics, join a queue and know when to arrive—without
                spending the day in a waiting room.
              </p>
              <button
                type="button"
                className="landing-button landing-button--light"
                onClick={downloadApp}
                disabled={preparingDownload}
              >
                <DownloadIcon />
                {preparingDownload ? 'Preparing app…' : 'Download for Android'}
              </button>
              <small>We automatically select the smaller package for your phone when supported.</small>
            </div>

            <div className="patient-phone" aria-hidden="true">
              <div className="patient-phone__top" />
              <div className="patient-phone__brand">
                <img src="/web-app-manifest-192x192.png" alt="" />
                <span>Intezo</span>
              </div>
              <p>Your queue</p>
              <strong>Q-025</strong>
              <span className="patient-phone__status"><i /> You are next</span>
              <div className="patient-phone__detail">
                <span>Estimated wait</span>
                <strong>8 minutes</strong>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__content">
          <Link to="/" className="landing-brand" aria-label="Intezo home">
            <img src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
            <span>Intezo</span>
          </Link>
          <p>Better queues. Better care.</p>
          <div className="landing-footer__links">
            <Link to="/clinic/login">Clinic</Link>
            <Link to="/doctor/login">Doctor</Link>
            <Link to="/admin/login">Admin</Link>
          </div>
          <small>© {new Date().getFullYear()} Intezo</small>
        </div>
      </footer>
    </div>
  );
};

export default MainPage;
