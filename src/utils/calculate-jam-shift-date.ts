import dayjs from "dayjs";

export const calculateJamShiftDate = (
  jamMasuk: string,
  jamKeluar: string,
  date: Date | null = null,
  isTommorow = false,
) => {
  let baseDay = isTommorow ? dayjs().add(1, "day") : dayjs();

  if (date) {
    baseDay = dayjs(date);
  }

  const baseDayFormatted = baseDay.format("YYYY-MM-DD");
  const jamMasukShiftDate = dayjs(
    `${baseDayFormatted} ${jamMasuk}`,
  ).millisecond(0);

  // Jam Keluar
  let jamKeluarShiftDate = dayjs(
    `${baseDayFormatted} ${jamKeluar}`,
  ).millisecond(0);

  if (
    jamKeluarShiftDate.isBefore(jamMasukShiftDate) ||
    jamKeluarShiftDate.isSame(jamMasukShiftDate)
  ) {
    jamKeluarShiftDate = jamKeluarShiftDate.add(1, "day");
  }

  return {
    jamMasukDate: jamMasukShiftDate.toDate(),
    jamKeluarDate: jamKeluarShiftDate.toDate(),
  };
};
