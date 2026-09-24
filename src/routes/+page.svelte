<script lang="ts">
    import { resolve } from '$app/paths';
    import { openAuthModal } from '$lib/auth-modal';
</script>

<section class="hero-shell">
    <div class="background-grid"></div>

    <nav class="topbar">
        <div class="brand-wrap">
            <div class="brand-mark">P</div>
            <div class="brand-text">
                <span class="brand-name">PreListr</span>
                <span class="brand-tag">eBay → Poshmark prelisting</span>
            </div>
        </div>
        <div class="nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#impact">Impact</a>
        </div>
        <a class="nav-cta" href={resolve('/auth/active-items')}>Open app</a>
        <button class="nav-cta" type="button" onclick={() => openAuthModal('signin')}>
            Sign In
        </button>
    </nav>

    <div class="hero">
        <div class="hero-copy">
            <p class="eyebrow">Prepare first. Review before you publish.</p>
            <h1>Turn eBay data into a Poshmark draft you can review.</h1>
            <p class="lede">
                PreListr carries your eBay listing details into a Poshmark-ready draft, so you can spend less
                time retyping and keep the final listing decision in human hands.
            </p>
            <div class="cta-row">
                <a class="primary-btn" href={resolve('/auth/active-items')}>Launch workspace</a>
                <a class="secondary-btn" href="#workflow">See how it works</a>
            </div>
            <div class="stat-row">
                <div>
                    <strong>1 source</strong>
                    <span>your existing eBay listing</span>
                </div>
                <div>
                    <strong>1 draft</strong>
                    <span>ready for Poshmark review</span>
                </div>
                <div>
                    <strong>100%</strong>
                    <span>your call before publishing</span>
                </div>
            </div>
        </div>

        <div class="hero-visual">
            <div class="console-panel">
                <div class="window-bar">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div class="panel-header">
                    <span class="chip success">Draft ready</span>
                    <span class="chip neutral">eBay data → Poshmark draft</span>
                </div>
                <div class="listing-card main-card">
                    <div class="listing-meta">
                        <span>eBay Item</span>
                        <span>Prepared</span>
                    </div>
                    <h3>Vintage Leather Tote</h3>
                    <p>Title, pricing, photos, and product notes are ready for your review.</p>
                </div>
                <div class="mini-grid">
                    <div class="mini-card">
                        <span>Title</span>
                        <strong>Vintage Leather Tote</strong>
                    </div>
                    <div class="mini-card">
                        <span>Price</span>
                        <strong>$89</strong>
                    </div>
                    <div class="mini-card highlight">
                        <span>Review</span>
                        <strong>Your approval</strong>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="feature-section" id="features">
    <div class="section-heading">
        <p class="eyebrow">Built for deliberate speed</p>
        <h2>Fast preparation. Thoughtful control.</h2>
    </div>
    <div class="feature-grid">
        <article class="feature-card">
            <div class="icon">01</div>
            <h3>Bring over the essentials</h3>
            <p>
                Start with the title, price, photos, and notes already in your eBay listing.
            </p>
        </article>
        <article class="feature-card">
            <div class="icon">02</div>
            <h3>Skip repetitive setup</h3>
            <p>
                Use prepared data as a starting point for the Poshmark listing instead of entering it all again.
            </p>
        </article>
        <article class="feature-card">
            <div class="icon">03</div>
            <h3>Review before publishing</h3>
            <p>
                PreListr prepares the draft; you check the final Poshmark details and decide when it is ready to post.
            </p>
        </article>
    </div>
</section>

<section class="workflow" id="workflow">
    <div class="section-heading center">
        <p class="eyebrow">How the flow works</p>
        <h2>From eBay listing to a Poshmark draft, with you in control.</h2>
    </div>
    <div class="timeline">
        <div class="step">
            <div class="step-number">1</div>
            <div>
                <h3>Select an eBay item</h3>
                <p>Choose an active eBay listing and bring its existing data into the workflow.</p>
            </div>
        </div>
        <div class="step">
            <div class="step-number">2</div>
            <div>
                <h3>Generate the draft</h3>
                <p>Prepare a Poshmark draft with the details and media you already collected.</p>
            </div>
        </div>
        <div class="step">
            <div class="step-number">3</div>
            <div>
                <h3>Review before posting</h3>
                <p>Check the draft for accuracy, then choose whether to publish or keep refining it.</p>
            </div>
        </div>
    </div>
</section>

<section class="impact" id="impact">
    <div class="impact-card">
        <p class="eyebrow">Why it matters</p>
        <h2>Move inventory faster without handing over the final call.</h2>
        <p>
            PreListr is for resellers who want a faster path from eBay data to a Poshmark draft, while keeping
            the final review and publishing decision where it belongs: with a person.
        </p>
    </div>
</section>

<style>
    :global(body) {
        margin: 0;
        background: #07111f;
        font-family: "Space Grotesk", "Trebuchet MS", sans-serif;
        color: #edf6ff;
    }

    :global(html) {
        scroll-behavior: smooth;
    }

    .hero-shell {
        position: relative;
        overflow: hidden;
        background:
            radial-gradient(circle at top left, rgba(118, 92, 255, 0.35), transparent 28%),
            radial-gradient(circle at bottom right, rgba(0, 224, 193, 0.2), transparent 25%),
            linear-gradient(135deg, #040b14 0%, #0a1628 45%, #07111f 100%);
        padding: 1.5rem clamp(1.2rem, 2vw, 2rem) 4rem;
    }

    .background-grid {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
        background-size: 32px 32px;
        mask-image: radial-gradient(circle at center, black 35%, transparent 100%);
        pointer-events: none;
    }

    .topbar,
    .hero,
    .feature-section,
    .workflow,
    .impact {
        position: relative;
        z-index: 1;
    }

    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        max-width: 1200px;
        margin: 0 auto 3.5rem;
        padding: 0.5rem 0;
    }

    .brand-wrap {
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .brand-mark {
        display: grid;
        place-items: center;
        width: 2.35rem;
        height: 2.35rem;
        border-radius: 12px;
        background: linear-gradient(135deg, #8b5cf6, #22d3ee);
        box-shadow: 0 0 30px rgba(103, 80, 255, 0.45);
        font-weight: 800;
        color: white;
    }

    .brand-text {
        display: flex;
        flex-direction: column;
    }

    .brand-name {
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .brand-tag {
        font-size: 0.72rem;
        color: rgba(226, 232, 240, 0.7);
    }

    .nav-links {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .nav-links a,
    .nav-cta,
    .primary-btn,
    .secondary-btn {
        text-decoration: none;
        transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
    }

    .nav-links a {
        color: rgba(226, 232, 240, 0.8);
        font-size: 0.95rem;
    }

    .nav-cta,
    .primary-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.85rem 1.4rem;
        border-radius: 999px;
        border: 0;
        appearance: none;
        font-weight: 700;
        background: linear-gradient(135deg, #7c3aed, #22d3ee);
        box-shadow: 0 12px 32px rgba(124, 58, 237, 0.38);
        color: white;
    }

    .secondary-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.85rem 1.4rem;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.35);
        color: white;
    }

    .nav-links a:hover,
    .nav-cta:hover,
    .primary-btn:hover,
    .secondary-btn:hover {
        transform: translateY(-1px);
    }

    .hero {
        display: grid;
        grid-template-columns: 1.08fr 0.92fr;
        gap: clamp(1.5rem, 3vw, 4rem);
        align-items: center;
        max-width: 1200px;
        margin: 0 auto;
    }

    .hero-copy h1 {
        margin: 0;
        font-size: clamp(3rem, 5vw, 5rem);
        line-height: 0.96;
        letter-spacing: 0;
        max-width: 620px;
    }

    .eyebrow {
        margin: 0 0 1rem;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #67e8f9;
    }

    .lede {
        margin-top: 1.2rem;
        max-width: 620px;
        font-size: 1.12rem;
        line-height: 1.7;
        color: rgba(226, 232, 240, 0.82);
    }

    .cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-top: 2rem;
    }

    .stat-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        margin-top: 2.25rem;
    }

    .stat-row div {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 120px;
    }

    .stat-row strong {
        font-size: 1.6rem;
        color: #f8fbff;
    }

    .stat-row span {
        font-size: 0.88rem;
        color: rgba(191, 219, 254, 0.8);
    }

    .hero-visual {
        display: flex;
        justify-content: center;
    }

    .console-panel {
        width: min(100%, 520px);
        padding: 1rem;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 24px;
        background: rgba(11, 17, 32, 0.72);
        backdrop-filter: blur(18px);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
    }

    .window-bar {
        display: flex;
        gap: 0.55rem;
        padding: 0.2rem 0.2rem 0.9rem;
    }

    .window-bar span {
        display: block;
        width: 0.72rem;
        height: 0.72rem;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.18);
    }

    .window-bar span:nth-child(1) { background: #f87171; }
    .window-bar span:nth-child(2) { background: #fbbf24; }
    .window-bar span:nth-child(3) { background: #4ade80; }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
    }

    .chip.success {
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid rgba(34, 197, 94, 0.35);
        color: #86efac;
    }

    .chip.neutral {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(96, 165, 250, 0.3);
        color: #bfdbfe;
    }

    .listing-card {
        padding: 1rem 1.1rem;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.85);
    }

    .main-card {
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 18px 28px rgba(15, 118, 110, 0.18);
    }

    .listing-meta {
        display: flex;
        justify-content: space-between;
        color: rgba(191, 219, 254, 0.8);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .listing-card h3 {
        margin: 0.75rem 0 0.4rem;
        font-size: 1.7rem;
        letter-spacing: -0.04em;
    }

    .listing-card p {
        margin: 0;
        color: rgba(226, 232, 240, 0.8);
        line-height: 1.6;
    }

    .mini-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.9rem;
        margin-top: 1rem;
    }

    .mini-card {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.8rem 0.8rem;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.78);
    }

    .mini-card span {
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(191, 219, 254, 0.7);
    }

    .mini-card strong {
        font-size: 0.96rem;
        line-height: 1.4;
    }

    .mini-card.highlight {
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(34, 211, 238, 0.18));
        border-color: rgba(103, 232, 249, 0.42);
    }

    .feature-section,
    .workflow,
    .impact {
        max-width: 1200px;
        margin: 0 auto;
        padding: 5rem 1.2rem 0;
    }

    .section-heading {
        margin-bottom: 2rem;
    }

    .section-heading.center {
        text-align: center;
    }

    .section-heading h2 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3rem);
        letter-spacing: 0;
    }

    .feature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.2rem;
    }

    .feature-card {
        padding: 1.4rem;
        border-radius: 22px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.56));
        box-shadow: 0 16px 42px rgba(15, 23, 42, 0.3);
    }

    .icon {
        display: inline-grid;
        place-items: center;
        width: 2.7rem;
        height: 2.7rem;
        border-radius: 12px;
        margin-bottom: 1rem;
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.28), rgba(34, 211, 238, 0.2));
        border: 1px solid rgba(147, 197, 253, 0.2);
        font-weight: 800;
        color: #dbeafe;
    }

    .feature-card h3 {
        margin: 0 0 0.7rem;
        font-size: 1.35rem;
    }

    .feature-card p,
    .step p,
    .impact-card p {
        margin: 0;
        line-height: 1.7;
        color: rgba(191, 219, 254, 0.8);
    }

    .timeline {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.3rem;
        margin-top: 2rem;
    }

    .step {
        display: flex;
        gap: 1rem;
        padding: 1.3rem;
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        background: rgba(15, 23, 42, 0.7);
    }

    .step-number {
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        background: linear-gradient(135deg, #8b5cf6, #22d3ee);
        font-weight: 800;
        box-shadow: 0 10px 26px rgba(139, 92, 246, 0.28);
    }

    .step h3 {
        margin: 0 0 0.4rem;
        font-size: 1.2rem;
    }

    .impact-card {
        margin-top: 3rem;
        padding: clamp(1.5rem, 3vw, 2.5rem);
        border-radius: 28px;
        border: 1px solid rgba(103, 232, 249, 0.28);
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(49, 46, 129, 0.66));
        box-shadow: 0 18px 40px rgba(17, 24, 39, 0.32);
    }

    .impact-card h2 {
        margin: 0 0 1rem;
        font-size: clamp(2rem, 4vw, 3rem);
        letter-spacing: 0;
    }

    @media (max-width: 900px) {
        .hero {
            grid-template-columns: 1fr;
        }
        .feature-grid,
        .timeline {
            grid-template-columns: 1fr;
        }
        .topbar {
            flex-wrap: wrap;
            gap: 1rem;
        }
        .nav-links {
            order: 3;
            width: 100%;
            justify-content: center;
        }
    }

    @media (max-width: 560px) {
        .hero-shell {
            padding-bottom: 3rem;
        }
        .topbar {
            justify-content: center;
        }
        .mini-grid {
            grid-template-columns: 1fr;
        }
        .cta-row {
            flex-direction: column;
        }
        .primary-btn,
        .secondary-btn,
        .nav-cta {
            width: 100%;
        }
    }
</style>
