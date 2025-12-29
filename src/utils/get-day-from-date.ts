import dayjs from "dayjs";

export const getDayFromDate = (date: Date): number => {
  if (!date) return -1;
  const day = dayjs(date).day();
  return day === 0 ? 6 : day - 1;
};

export const convertDayDatabaseToDayjs = (index: number): number => {
  return index >= 6 ? 0 : index + 1;
};

export const convertDayDayjsToDatabase = (index: number): number => {
  return index <= 0 ? 6 : index - 1;
};
