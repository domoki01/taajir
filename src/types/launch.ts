/**
 * Whether the site is open to the public, or holding behind a countdown while
 * it gathers listings and buyers.
 *
 * `active` is the default everywhere it is absent — see src/server/launch.ts.
 */
export type LaunchState = "prelaunch" | "active";

export type LaunchSettings = {
  state: LaunchState;
  /** Countdown target, epoch ms. null means "held with no date announced". */
  launchAt: number | null;
  /** Set once, by executeLaunch. */
  launchedAt: number | null;
  updatedAt: number;
  updatedBy: string;
};

/** What the funnel and the admin panel both need to know. */
export type LaunchStatus = LaunchSettings & {
  /** launchAt has passed. The switch is still the admin's to throw. */
  timerElapsed: boolean;
};

/**
 * One intended message, written before anything is sent.
 *
 * The outbox exists because two of the three channels the launch plan asks for
 * have no provider wired yet: a row that stays `queued` is a message waiting
 * for credentials, not a message lost.
 */
export type OutboxChannel = "push" | "email" | "sms";

export type OutboxEntry = {
  id: string;
  uid: string;
  channel: OutboxChannel;
  /** Address the message is for — email, phone, or "device" for push. */
  target: string;
  status: "queued" | "sent" | "failed" | "skipped";
  error: string | null;
  createdAt: number;
  sentAt: number | null;
};
