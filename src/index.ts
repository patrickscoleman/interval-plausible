import Interval, { io } from '@interval/sdk';
import 'dotenv/config'; // loads environment variables from .env
import axios from 'axios';
import { DateTime} from 'luxon';

const baseUrl = 'https://plausible.io/api/v1/stats/';
const siteId = 'interval.com';
const plausibleApiKey = process.env.PLAUSIBLE_KEY;

function formatJSDate(jsDate) {
  return DateTime.fromJSDate(jsDate).toFormat('yyyy-LL-dd');
}

const interval = new Interval({
  apiKey: process.env.INTERVAL_KEY,
  actions: {
    weekly_dashboard: {
      handler: async () => {
        // Get data from plausible.io
        const response = await axios.get(baseUrl + 'timeseries', {
          params: {
            site_id: siteId,
            period: 'custom',
            date: '2022-06-01,' + formatJSDate(new Date()),
            interval: 'date',
            metrics: 'visitors,bounce_rate',
          },
          headers: {
            Authorization: `Bearer ${plausibleApiKey}`,
          },
          responseType: 'json',
        });

        let data = response.data['results'];

        // Import d3 ESM modules in a Typescript compatible way
        const { timeParse } = await (eval('import("d3-time-format")') as Promise<typeof import('d3-time-format')>);
        const { timeWeek } = await (eval('import("d3-time")') as Promise<typeof import('d3-time')>);
        const { nest } = await (eval('import("d3-collection")') as Promise<typeof import('d3-collection')>);
        const { sum, mean, descending } = await (eval('import("d3-array")') as Promise<typeof import('d3-array')>);

        // Format date strings and group dates by week
        const dateFormat = timeParse("%Y-%m-%d");
        data.forEach((d,_i) => {
          d.date = timeWeek(dateFormat(d.date));
        });

        // Summarize data by week + sum visitors and average bounce rate
        const groupedData = nest()
                            .key((d: typeof data) => { return formatJSDate(d.date); })
                            // @ts-ignore
                            .rollup((v) => { return {
                              visitors: sum(v, (d: typeof data) => { return d.visitors; }),
                              bounce_rate: mean(v, (d: typeof data) => { return d.bounce_rate; })
                            }; })
                            .sortKeys(descending)
                            .entries(data);

        // Change data back to array of objects
        let formattedData = [];
        groupedData.forEach((object) => {
          formattedData.push({
            date: object['key'],
            // @ts-ignore
            visitors: object['value']['visitors'],
            // @ts-ignore
            bounce_rate: object['value']['bounce_rate'],
          });
        });

        // Display data in Interval
        await io.display.table('Web traffic data', {
          helpText: 'Data from plausible.io.',
          data: formattedData,
        });
      },
      name: 'Weekly dashboard',
    }
  },
});

interval.listen();
