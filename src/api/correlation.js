import { apiClient } from './client';
import { clean } from './wells';

export const correlationApi = {
  /**
   * @param {{wellIds: string[], align?: string, reference?: string, binM?: number,
   *   minWells?: number, eventTypes?: string[]}} opts
   */
  get: ({ wellIds, align, reference, binM, minWells, eventTypes }) =>
    apiClient.get('/correlation', {
      params: clean({
        wells: wellIds.join(','),
        align,
        reference,
        bin_m: binM,
        min_wells: minWells,
        event_types: eventTypes?.length ? eventTypes.join(',') : null,
      }),
    }),
};
