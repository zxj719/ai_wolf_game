function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inferDynamicsShape(frames) {
  if (!frames.length) {
    return 'flat';
  }

  const peakIndex = frames.reduce(
    (bestIndex, current, currentIndex, list) => (current > list[bestIndex] ? currentIndex : bestIndex),
    0,
  );
  const third = Math.max(1, Math.floor(frames.length / 3));
  const startAvg = average(frames.slice(0, third));
  const middleAvg = average(frames.slice(third, third * 2));
  const endAvg = average(frames.slice(third * 2));
  const spread = Math.max(...frames) - Math.min(...frames);

  if (spread < 0.12) {
    return 'flat';
  }
  if (
    peakIndex >= Math.floor(frames.length * 0.45)
    && peakIndex < frames.length - 1
    && frames.at(-1) < frames[peakIndex] * 0.5
  ) {
    return 'build-and-release';
  }
  if (middleAvg > startAvg * 1.4 && endAvg < middleAvg * 0.82) {
    return 'build-and-release';
  }
  if (endAvg > startAvg * 1.35) {
    return 'steady-rise';
  }
  if (startAvg > endAvg * 1.35) {
    return 'falling-arc';
  }
  return 'steady-drive';
}

function getEnergyLevel(relativeEnergy) {
  if (relativeEnergy >= 0.72) {
    return 'high';
  }
  if (relativeEnergy >= 0.36) {
    return 'medium';
  }
  return 'low';
}

function getSectionLabel(index, total, relativeEnergy, peakIndex) {
  if (index === 0) {
    return 'Opening';
  }
  if (index === total - 1) {
    return 'Outro';
  }
  if (index === peakIndex) {
    return 'Peak';
  }
  if (relativeEnergy >= 0.62) {
    return 'Lift';
  }
  if (relativeEnergy <= 0.24) {
    return 'Break';
  }
  return `Section ${index + 1}`;
}

export function buildTrackSummary({ file, audio, energyFrames }) {
  const rawFrames = Array.isArray(energyFrames) ? energyFrames : [];
  const frames = rawFrames.length ? rawFrames.map((value) => Math.max(0, Number(value) || 0)) : [0];
  const maxEnergy = Math.max(...frames, 0.0001);
  const duration = Number(audio?.duration) || 0;
  const sectionDuration = frames.length ? duration / frames.length : 0;
  const peakIndex = frames.reduce(
    (bestIndex, current, currentIndex, list) => (current > list[bestIndex] ? currentIndex : bestIndex),
    0,
  );

  const energySections = frames.map((value, index) => {
    const relativeEnergy = clamp(value / maxEnergy, 0, 1);
    return {
      index: index + 1,
      name: getSectionLabel(index, frames.length, relativeEnergy, peakIndex),
      time_start: Number((sectionDuration * index).toFixed(1)),
      time_end: Number((sectionDuration * (index + 1)).toFixed(1)),
      raw_energy: Number(value.toFixed(4)),
      relative_energy: Number(relativeEnergy.toFixed(3)),
      energy_level: getEnergyLevel(relativeEnergy),
    };
  });

  const introWindow = energySections[0] || null;
  const climaxWindow = energySections[peakIndex] || null;
  const outroWindow = energySections.at(-1) || null;
  const averageEnergy = average(frames);
  const hookIndex = frames.reduce((bestIndex, current, currentIndex, list) => {
    if (currentIndex === 0) {
      return bestIndex;
    }
    const delta = current - list[currentIndex - 1];
    const bestDelta = list[bestIndex] - (bestIndex > 0 ? list[bestIndex - 1] : 0);
    return delta > bestDelta ? currentIndex : bestIndex;
  }, 0);

  return {
    source: 'browser-upload',
    analysis_mode: 'browser-energy-profile',
    file_name: file?.name || 'track',
    file_size_bytes: Number(file?.size) || 0,
    mime_type: file?.type || 'audio/mpeg',
    duration: Number(duration.toFixed(2)),
    sample_rate: Number(audio?.sampleRate) || 0,
    channels: Number(audio?.numberOfChannels) || 0,
    frame_count: frames.length,
    energy_sections: energySections,
    arrangement_signals: {
      average_energy: Number(averageEnergy.toFixed(4)),
      peak_energy: Number(maxEnergy.toFixed(4)),
      dynamics: {
        shape: inferDynamicsShape(frames),
        contrast: Number((maxEnergy - Math.min(...frames)).toFixed(4)),
      },
      intro_window: introWindow,
      hook_window: energySections[hookIndex] || null,
      climax_window: climaxWindow,
      outro_window: outroWindow,
    },
  };
}

function asStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function normalizeArrangementResponse(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    summary: typeof source.summary === 'string' ? source.summary.trim() : '',
    style_tags: asStringArray(source.style_tags),
    mood_tags: asStringArray(source.mood_tags),
    hook_moment: typeof source.hook_moment === 'string' ? source.hook_moment.trim() : '',
    climax_moment: typeof source.climax_moment === 'string' ? source.climax_moment.trim() : '',
    listening_focus: asStringArray(source.listening_focus),
    mix_highlights: asStringArray(source.mix_highlights),
    sections: Array.isArray(source.sections)
      ? source.sections.map((section, index) => ({
          name: typeof section?.name === 'string' && section.name.trim() ? section.name.trim() : `Section ${index + 1}`,
          time_start: Number(section?.time_start) || 0,
          time_end: Number(section?.time_end) || 0,
          energy: typeof section?.energy === 'string' ? section.energy.trim() : '',
          function: typeof section?.function === 'string' ? section.function.trim() : '',
          arrangement_notes: asStringArray(section?.arrangement_notes),
          transition: typeof section?.transition === 'string' ? section.transition.trim() : '',
        }))
      : [],
  };
}
