import dayjs from "dayjs";

export const calculateTimeDuration = (startTime: string, endTime: string) => {
  let start = dayjs(startTime, "HH:mm:ss");
  let end = dayjs(endTime, "HH:mm:ss");

  // If end is before start, add 1 day
  if (end.isBefore(start)) {
    end = end.add(1, "day");
  }

  const diff = end.diff(start);
  const dur = dayjs.duration(diff);

  return dur.format("HH:mm:ss");
};

export const calculateTimeDifferent = (
  startTime: string,
  endTime: string,
  isEndNextDay = false
) => {
  const today = dayjs().format("YYYY-MM-DD");
  let start = dayjs(`${today} ${startTime}`);
  let end = dayjs(`${today} ${endTime}`);

  // If end is before start, add 1 day
  if (isEndNextDay) {
    end = end.add(1, "day");
  }

  const diff = end.diff(start);

  const dur = dayjs.duration(diff);

  return dur.asMinutes();
};
