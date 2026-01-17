import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { getDay, getHours, getMinutes, addMinutes, setHours, setMinutes, addDays, isAfter, isBefore, startOfDay } from 'date-fns';

export interface TradingSession {
  start: { hour: number; minute: number };
  end: { hour: number; minute: number };
}

@Injectable()
export class MarketHoursService {
  private readonly timezone: string;
  private readonly morningSession: TradingSession = {
    start: { hour: 9, minute: 0 },
    end: { hour: 11, minute: 30 },
  };
  private readonly afternoonSession: TradingSession = {
    start: { hour: 13, minute: 0 },
    end: { hour: 15, minute: 0 },
  };

  private readonly holidays: Date[] = [];

  constructor(private readonly configService: ConfigService) {
    this.timezone = this.configService.get<string>('TZ', 'Asia/Ho_Chi_Minh');
  }

  private toVnTime(date: Date): Date {
    return toZonedTime(date, this.timezone);
  }

  private fromVnTime(date: Date): Date {
    return fromZonedTime(date, this.timezone);
  }

  isTradingTime(now: Date = new Date()): boolean {
    const vnNow = this.toVnTime(now);
    const dayOfWeek = getDay(vnNow);

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    if (this.isHoliday(vnNow)) {
      return false;
    }

    const hour = getHours(vnNow);
    const minute = getMinutes(vnNow);
    const timeInMinutes = hour * 60 + minute;

    const morningStart = this.morningSession.start.hour * 60 + this.morningSession.start.minute;
    const morningEnd = this.morningSession.end.hour * 60 + this.morningSession.end.minute;
    const afternoonStart = this.afternoonSession.start.hour * 60 + this.afternoonSession.start.minute;
    const afternoonEnd = this.afternoonSession.end.hour * 60 + this.afternoonSession.end.minute;

    const inMorning = timeInMinutes >= morningStart && timeInMinutes <= morningEnd;
    const inAfternoon = timeInMinutes >= afternoonStart && timeInMinutes <= afternoonEnd;

    return inMorning || inAfternoon;
  }

  isTradingDay(date: Date = new Date()): boolean {
    const vnDate = this.toVnTime(date);
    const dayOfWeek = getDay(vnDate);
    return dayOfWeek !== 0 && dayOfWeek !== 6 && !this.isHoliday(vnDate);
  }

  isHoliday(date: Date): boolean {
    const checkDate = startOfDay(this.toVnTime(date));
    return this.holidays.some(
      (holiday) => startOfDay(holiday).getTime() === checkDate.getTime()
    );
  }

  nextBoundary(now: Date = new Date()): { type: 'session_start' | 'session_end' | 'next_day'; time: Date } {
    const vnNow = this.toVnTime(now);
    const hour = getHours(vnNow);
    const minute = getMinutes(vnNow);
    const timeInMinutes = hour * 60 + minute;

    const morningStart = this.morningSession.start.hour * 60 + this.morningSession.start.minute;
    const morningEnd = this.morningSession.end.hour * 60 + this.morningSession.end.minute;
    const afternoonStart = this.afternoonSession.start.hour * 60 + this.afternoonSession.start.minute;
    const afternoonEnd = this.afternoonSession.end.hour * 60 + this.afternoonSession.end.minute;

    let targetTime: Date;
    let type: 'session_start' | 'session_end' | 'next_day';

    if (timeInMinutes < morningStart) {
      targetTime = setMinutes(setHours(vnNow, this.morningSession.start.hour), this.morningSession.start.minute);
      type = 'session_start';
    } else if (timeInMinutes < morningEnd) {
      targetTime = setMinutes(setHours(vnNow, this.morningSession.end.hour), this.morningSession.end.minute);
      type = 'session_end';
    } else if (timeInMinutes < afternoonStart) {
      targetTime = setMinutes(setHours(vnNow, this.afternoonSession.start.hour), this.afternoonSession.start.minute);
      type = 'session_start';
    } else if (timeInMinutes < afternoonEnd) {
      targetTime = setMinutes(setHours(vnNow, this.afternoonSession.end.hour), this.afternoonSession.end.minute);
      type = 'session_end';
    } else {
      let nextDay = addDays(vnNow, 1);
      while (getDay(nextDay) === 0 || getDay(nextDay) === 6 || this.isHoliday(nextDay)) {
        nextDay = addDays(nextDay, 1);
      }
      targetTime = setMinutes(setHours(nextDay, this.morningSession.start.hour), this.morningSession.start.minute);
      type = 'next_day';
    }

    return { type, time: this.fromVnTime(targetTime) };
  }

  getLastNTradingDays(n: number, from: Date = new Date()): Date[] {
    const result: Date[] = [];
    let current = this.toVnTime(from);

    while (result.length < n) {
      if (this.isTradingDay(current)) {
        result.push(startOfDay(current));
      }
      current = addDays(current, -1);
    }

    return result;
  }
}
