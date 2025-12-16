import dayjs from "dayjs";

export const getDayFromDate = (date: Date): number => {
  if (!date) return -1;
  const day = dayjs(date).day();
  return day === 0 ? 6 : day - 1;
};
