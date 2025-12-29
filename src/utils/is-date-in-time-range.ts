import dayjs from "dayjs";

export const isDateInTimeRange = (
  startTime: string,
  endTime: string,
  now: dayjs.Dayjs = dayjs()
): boolean => {
  const today = now.startOf("day");

  const startToday = dayjs(`${today.format("YYYY-MM-DD")} ${startTime}`);
  const endToday = dayjs(`${today.format("YYYY-MM-DD")} ${endTime}`);

  // Case 1: range normal (tidak lewat tengah malam)
  if (endToday.isAfter(startToday)) {
    return (
      (now.isAfter(startToday) || now.isSame(startToday)) &&
      now.isBefore(endToday)
    );
  }

  // Case 2: range lewat tengah malam
  const startYesterday = startToday.subtract(1, "day");
  const endTomorrow = endToday.add(1, "day");

  return (
    // kemarin malam → hari ini pagi
    ((now.isAfter(startYesterday) || now.isSame(startYesterday)) &&
      now.isBefore(endToday)) ||
    // hari ini malam → besok pagi
    ((now.isAfter(startToday) || now.isSame(startToday)) &&
      now.isBefore(endTomorrow))
  );
};

export const checkIfStartTimeIsYesterday = (
  startTime: string,
  endTime: string,
  now: dayjs.Dayjs = dayjs()
): boolean => {
  const toSeconds = (t: string) => {
    const [h, m, s] = t.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  };

  const start = toSeconds(startTime);
  const end = toSeconds(endTime);
  const current = now.hour() * 3600 + now.minute() * 60 + now.second();

  // tidak lewat tengah malam → tidak mungkin kemarin
  if (start < end) return false;

  // lewat tengah malam & sekarang masih pagi
  return current < end;
};
