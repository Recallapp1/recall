/**
 * Pure layout for the schedule grid: places events into columns (practitioners
 * in the day view, days in the week view) and splits overlapping events into
 * side-by-side lanes. Times are minutes since midnight in the clinic's zone.
 */

export interface ScheduleEventInput {
  id: string;
  columnId: string;
  startMinute: number;
  endMinute: number;
}

export interface PlacedEvent<T extends ScheduleEventInput> {
  event: T;
  /** Offset from the top of the visible range, as a fraction of its height (0–1). */
  top: number;
  height: number;
  /** Lane within the overlap cluster, and how many lanes the cluster has. */
  lane: number;
  lanes: number;
}

export interface VisibleRange {
  startMinute: number;
  endMinute: number;
}

export function layoutColumn<T extends ScheduleEventInput>(
  events: readonly T[],
  range: VisibleRange,
): PlacedEvent<T>[] {
  const span = range.endMinute - range.startMinute;
  const visible = events
    .filter((event) => event.endMinute > range.startMinute && event.startMinute < range.endMinute)
    .toSorted((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);

  const placed: PlacedEvent<T>[] = [];
  let cluster: PlacedEvent<T>[] = [];
  let clusterEnd = -Infinity;
  let laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = laneEnds.length;
    for (const item of cluster) item.lanes = lanes;
    cluster = [];
    laneEnds = [];
  };

  for (const event of visible) {
    if (event.startMinute >= clusterEnd) closeCluster();

    let lane = laneEnds.findIndex((end) => end <= event.startMinute);
    if (lane === -1) lane = laneEnds.push(event.endMinute) - 1;
    else laneEnds[lane] = event.endMinute;

    const start = Math.max(event.startMinute, range.startMinute);
    const end = Math.min(event.endMinute, range.endMinute);
    const item: PlacedEvent<T> = {
      event,
      top: (start - range.startMinute) / span,
      height: (end - start) / span,
      lane,
      lanes: 1,
    };
    placed.push(item);
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, event.endMinute);
  }
  closeCluster();

  return placed;
}

/** Hour marks to draw, e.g. 08:00 … 19:00 for 08:00–20:00. */
export function hourMarks(range: VisibleRange): number[] {
  const marks: number[] = [];
  for (
    let minute = Math.ceil(range.startMinute / 60) * 60;
    minute < range.endMinute;
    minute += 60
  ) {
    marks.push(minute);
  }
  return marks;
}

export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
