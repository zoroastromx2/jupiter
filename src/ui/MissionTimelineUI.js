import {
  DEFAULT_LANGUAGE,
  getMilestoneTitle,
  normalizeLanguage,
  t
} from '../i18n/I18n.js';
import {
  buildMilestoneTooltipData,
  daysSinceEpochToMissionProgress,
  formatMissionColorHex,
  formatMissionOffset,
  formatTargetLabel,
  formatWindowBoundHours,
  getActiveMilestoneIndex,
  getMissionWindowBounds,
  missionUToDeltaHours
} from '../math/MissionTimeline.js';

const SCRUBBER_MAX = 1000;

/**
 * Interactive HUD controller for the active historical mission flight window.
 * Renders a scrubbable progress track, positioned milestone markers, and
 * clickable milestone buttons using textContent exclusively.
 */
export class MissionTimelineUI {
  constructor(rootElement, { onScrub, onSelectMilestone } = {}) {
    this.root = rootElement;
    this.onScrub = onScrub;
    this.onSelectMilestone = onSelectMilestone;

    this.mission = null;
    this.language = DEFAULT_LANGUAGE;
    this.lastDaysSinceEpoch = 0;
    this.isScrubbing = false;
    this.lastActiveIndex = -1;
    this.markerButtons = [];
    this.stepButtons = [];

    this.titleEl = rootElement?.querySelector('#mission-timeline-title') ?? null;
    this.windowEl = rootElement?.querySelector('#mission-timeline-window') ?? null;
    this.offsetEl = rootElement?.querySelector('#mission-timeline-offset') ?? null;
    this.statusEl = rootElement?.querySelector('#mission-timeline-status') ?? null;
    this.progressFillEl = rootElement?.querySelector('#mission-timeline-fill') ?? null;
    this.scrubberEl = rootElement?.querySelector('#mission-scrubber') ?? null;
    this.markersEl = rootElement?.querySelector('#mission-timeline-markers') ?? null;
    this.stepsEl = rootElement?.querySelector('#mission-milestone-list') ?? null;
    this.startBoundEl = rootElement?.querySelector('#mission-bound-start') ?? null;
    this.peakBoundEl = rootElement?.querySelector('#mission-bound-peak') ?? null;
    this.endBoundEl = rootElement?.querySelector('#mission-bound-end') ?? null;
    this.tooltipEl = rootElement?.querySelector('#mission-marker-tooltip') ?? null;
    this.tooltipOffsetEl = rootElement?.querySelector('#tooltip-offset') ?? null;
    this.tooltipTargetEl = rootElement?.querySelector('#tooltip-target') ?? null;
    this.tooltipFovEl = rootElement?.querySelector('#tooltip-fov') ?? null;
    this.tooltipTitleEl = rootElement?.querySelector('#tooltip-title') ?? null;
    this.hoveredMarkerIndex = -1;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.scrubberEl) return;

    this.scrubberEl.addEventListener('pointerdown', () => {
      this.isScrubbing = true;
    });

    const releaseScrub = () => {
      this.isScrubbing = false;
    };
    this.scrubberEl.addEventListener('pointerup', releaseScrub);
    this.scrubberEl.addEventListener('pointercancel', releaseScrub);
    this.scrubberEl.addEventListener('blur', releaseScrub);

    this.scrubberEl.addEventListener('input', () => {
      if (!this.mission) return;
      const u = Number(this.scrubberEl.value) / SCRUBBER_MAX;
      this.onScrub?.(u);
    });
  }

  setLanguage(lang) {
    this.language = normalizeLanguage(lang);

    if (this.scrubberEl) {
      this.scrubberEl.setAttribute(
        'aria-label',
        t(this.language, 'missionScrubberAria')
      );
    }
    if (this.markersEl) {
      this.markersEl.setAttribute(
        'aria-label',
        t(this.language, 'missionMarkersAria')
      );
    }
    if (this.stepsEl) {
      this.stepsEl.setAttribute(
        'aria-label',
        t(this.language, 'missionMilestonesAria')
      );
    }

    if (!this.mission) return;

    const prevHovered = this.hoveredMarkerIndex;
    const bounds = getMissionWindowBounds(this.mission);
    if (this.windowEl) {
      this.windowEl.textContent = t(this.language, 'missionWindow', {
        hours: bounds.windowHours
      });
    }
    if (this.peakBoundEl) {
      this.peakBoundEl.textContent = t(this.language, 'missionPeriapsis');
    }

    this.buildMilestones();
    this.sync(this.lastDaysSinceEpoch);

    if (prevHovered >= 0 && this.mission.milestones?.[prevHovered]) {
      this.showTooltip(this.mission.milestones[prevHovered], prevHovered);
    }
  }

  setMission(mission, daysSinceEpoch = 0) {
    this.mission = mission ?? null;
    this.lastDaysSinceEpoch = daysSinceEpoch;
    this.lastActiveIndex = -1;

    if (!this.root) return;

    if (!this.mission) {
      this.root.hidden = true;
      this.clearNodes();
      return;
    }

    const accent = formatMissionColorHex(this.mission.color);
    this.root.style.setProperty('--mission-accent', accent);
    this.root.hidden = false;

    const bounds = getMissionWindowBounds(this.mission);
    if (this.titleEl) this.titleEl.textContent = this.mission.name;
    if (this.windowEl) {
      this.windowEl.textContent = t(this.language, 'missionWindow', {
        hours: bounds.windowHours
      });
    }
    if (this.startBoundEl) {
      this.startBoundEl.textContent = formatWindowBoundHours(bounds.startHours);
    }
    if (this.peakBoundEl) {
      this.peakBoundEl.textContent = t(this.language, 'missionPeriapsis');
    }
    if (this.endBoundEl) {
      this.endBoundEl.textContent = formatWindowBoundHours(bounds.endHours);
    }

    this.buildMilestones();
    this.sync(daysSinceEpoch);
  }

  clearNodes() {
    this.markerButtons = [];
    this.stepButtons = [];
    this.hideTooltip();
    if (this.markersEl) this.markersEl.replaceChildren();
    if (this.stepsEl) this.stepsEl.replaceChildren();
  }

  showTooltip(milestone, index) {
    if (!this.tooltipEl || !this.mission || !milestone) return;
    const data = buildMilestoneTooltipData(
      this.mission,
      milestone,
      this.language,
      index
    );
    if (!data) return;

    this.hoveredMarkerIndex = index;
    if (this.tooltipOffsetEl) this.tooltipOffsetEl.textContent = data.offset;
    if (this.tooltipTargetEl) this.tooltipTargetEl.textContent = data.target;
    if (this.tooltipFovEl) this.tooltipFovEl.textContent = data.fov;
    if (this.tooltipTitleEl) this.tooltipTitleEl.textContent = data.title;

    this.tooltipEl.style.left = `${data.percent}%`;
    this.tooltipEl.dataset.align = data.align;
    this.tooltipEl.hidden = false;
  }

  hideTooltip(index = null) {
    if (index !== null && this.hoveredMarkerIndex !== index) return;
    this.hoveredMarkerIndex = -1;
    if (this.tooltipEl) this.tooltipEl.hidden = true;
  }

  buildMilestones() {
    this.clearNodes();
    const milestones = this.mission?.milestones ?? [];
    if (!milestones.length) return;

    for (let i = 0; i < milestones.length; i += 1) {
      const milestone = milestones[i];
      const deltaHours = missionUToDeltaHours(this.mission, milestone.t);
      const offsetText = formatMissionOffset(deltaHours);
      const targetText = formatTargetLabel(milestone.targetKey, this.language);
      const fovText = `${Math.round(milestone.defaultFov)}°`;
      const localizedTitle = getMilestoneTitle(
        this.mission.key,
        i,
        this.language,
        milestone.title
      );
      const pct = Math.max(0, Math.min(100, milestone.t * 100));

      if (this.markersEl) {
        const markerBtn = document.createElement('button');
        markerBtn.type = 'button';
        markerBtn.className = 'timeline-marker';
        markerBtn.style.left = `${pct}%`;
        markerBtn.dataset.milestoneIndex = String(i);
        markerBtn.setAttribute('aria-describedby', 'mission-marker-tooltip');
        markerBtn.setAttribute(
          'aria-label',
          t(this.language, 'markerJumpAria', {
            index: i + 1,
            title: localizedTitle,
            offset: offsetText,
            fov: fovText
          })
        );

        const pip = document.createElement('span');
        pip.className = 'timeline-marker-pip';
        pip.setAttribute('aria-hidden', 'true');
        markerBtn.appendChild(pip);

        markerBtn.addEventListener('pointerenter', () => {
          this.showTooltip(milestone, i);
        });
        markerBtn.addEventListener('pointerleave', () => {
          this.hideTooltip(i);
        });
        markerBtn.addEventListener('focus', () => {
          this.showTooltip(milestone, i);
        });
        markerBtn.addEventListener('blur', () => {
          this.hideTooltip(i);
        });
        markerBtn.addEventListener('click', () => {
          this.onSelectMilestone?.(milestone, i);
        });

        this.markersEl.appendChild(markerBtn);
        this.markerButtons.push(markerBtn);
      }

      if (this.stepsEl) {
        const stepBtn = document.createElement('button');
        stepBtn.type = 'button';
        stepBtn.className = 'milestone-step';
        stepBtn.dataset.milestoneIndex = String(i);
        stepBtn.title = `${localizedTitle} (${milestone.instrumentName}, ${fovText})`;

        const metaRow = document.createElement('span');
        metaRow.className = 'milestone-step-meta';

        const offsetSpan = document.createElement('span');
        offsetSpan.className = 'milestone-step-offset';
        offsetSpan.textContent = offsetText;

        const targetSpan = document.createElement('span');
        targetSpan.className = 'milestone-step-target';
        targetSpan.textContent = `${targetText} · ${fovText}`;

        metaRow.appendChild(offsetSpan);
        metaRow.appendChild(targetSpan);

        const titleSpan = document.createElement('span');
        titleSpan.className = 'milestone-step-title';
        titleSpan.textContent = localizedTitle;

        stepBtn.appendChild(metaRow);
        stepBtn.appendChild(titleSpan);

        stepBtn.addEventListener('click', () => {
          this.onSelectMilestone?.(milestone, i);
        });

        this.stepsEl.appendChild(stepBtn);
        this.stepButtons.push(stepBtn);
      }
    }
  }

  sync(daysSinceEpoch) {
    this.lastDaysSinceEpoch = daysSinceEpoch;
    if (!this.mission || !this.root || this.root.hidden) return -1;

    const progress = daysSinceEpochToMissionProgress(this.mission, daysSinceEpoch);
    const { u, deltaHours, inWindow } = progress;
    const offsetText = formatMissionOffset(deltaHours);
    const percent = Math.round(u * 100);

    if (this.offsetEl) {
      this.offsetEl.textContent = offsetText;
    }

    if (this.statusEl) {
      this.statusEl.textContent = inWindow
        ? `${percent}%`
        : t(this.language, 'missionOutsideWindow');
      this.statusEl.classList.toggle('is-outside', !inWindow);
    }

    if (this.progressFillEl) {
      this.progressFillEl.style.transform = `scaleX(${u.toFixed(4)})`;
    }

    if (this.scrubberEl && !this.isScrubbing) {
      const nextVal = String(Math.round(u * SCRUBBER_MAX));
      if (this.scrubberEl.value !== nextVal) {
        this.scrubberEl.value = nextVal;
      }
      this.scrubberEl.setAttribute('aria-valuetext', `${offsetText} (${percent}%)`);
    }

    const milestones = this.mission.milestones ?? [];
    const activeIndex = getActiveMilestoneIndex(milestones, u);

    for (let i = 0; i < milestones.length; i += 1) {
      const isActive = i === activeIndex;
      const isReached = u + 1e-6 >= milestones[i].t;

      const markerBtn = this.markerButtons[i];
      if (markerBtn) {
        markerBtn.classList.toggle('is-active', isActive);
        markerBtn.classList.toggle('is-reached', isReached);
      }

      const stepBtn = this.stepButtons[i];
      if (stepBtn) {
        stepBtn.classList.toggle('is-active', isActive);
        stepBtn.classList.toggle('is-reached', isReached);
        if (isActive) {
          stepBtn.setAttribute('aria-current', 'step');
        } else {
          stepBtn.removeAttribute('aria-current');
        }
      }
    }

    this.lastActiveIndex = activeIndex;
    return activeIndex;
  }
}
