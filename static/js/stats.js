var GenePattern = GenePattern || {};
GenePattern.stats = GenePattern.stats || {};
GenePattern.stats.project_updates = GenePattern.stats.project_updates || {};
GenePattern.stats.project_runs = GenePattern.stats.project_runs || {};
GenePattern.stats.usage_events = GenePattern.stats.usage_events || [];
GenePattern.stats.event_stats = GenePattern.stats.event_stats || {};

class Stats {
    constructor() {
        // Query the stats endpoint and render the tables
        Stats.query_project_stats().then(() => Stats.draw_project_tables());

    }

    static query_project_stats() {
        return fetch(`/services/projects/stats/`)
            .then(response => response.json())
            .then(response => {
                GenePattern.stats.project_updates = response['updates'];
                GenePattern.stats.project_runs = response['usage'];
            });
    }

    init_usage_tab() {
        if (!this.initialized) {
            Stats.query_usage_events().then(() => Stats.compile_usage_stats().then(() => Stats.draw_events_table()));
            this.initialized = true;
        }
    }

    filter_usage_events(event) {
        // Get the date tange
        const from = new Date($(event.target).parent().find('.nb-from').val());
        let to = new Date($(event.target).parent().find('.nb-to').val());
        to.setDate(to.getDate() + 1); // Correct date range for UTC time zone issues

        // Reset event stats
        GenePattern.stats.event_stats = {};

        // Recompile stats based on range
        Stats.compile_usage_stats(from, to).then(() => {
            // Clear the tables
            $('#nb-usage-tools').empty();
            $('#nb-usage-launches').empty();
            $('#nb-usage-labext').empty();
            $('#nb-usage-nbext').empty();
            $('#nb-usage-other').empty();

            // Draw the updated tables
            Stats.draw_events_table();
        })
    }

    static query_usage_events() {
        return fetch(`/services/usage/report/`)
            .then(response => response.json())
            .then(response => {
                GenePattern.stats.usage_events = response['events'];
            });
    }

    static compile_usage_stats(from=null, to=null) {
        return new Promise((resolve, reject) => {
            GenePattern.stats.usage_events.forEach(e => {
                // Filter events out of the date range if one is specified
                const created = new Date(e.created);
                if (!!from && created < from) return;
                if (!!to && created > to) return;

                // Special case for unknown tokens
                if (e.event_token === '') e.event_token = 'unknown';

                // Lazily initialize event_stats and increment counts for each event_token
                if (e.event_token in GenePattern.stats.event_stats) GenePattern.stats.event_stats[e.event_token].count++;
                else GenePattern.stats.event_stats[e.event_token] = {count: 1};

                // Note the latest time the event happened
                if (!GenePattern.stats.event_stats[e.event_token].latest)
                    GenePattern.stats.event_stats[e.event_token].latest = created;
                else if (GenePattern.stats.event_stats[e.event_token].latest < created)
                    GenePattern.stats.event_stats[e.event_token].latest = created;

                // Note the earliest time the event happened
                if (!GenePattern.stats.event_stats[e.event_token].earliest)
                    GenePattern.stats.event_stats[e.event_token].earliest = created;
                else if (GenePattern.stats.event_stats[e.event_token].earliest > created)
                    GenePattern.stats.event_stats[e.event_token].earliest = created;

                // Special parsing for tool_run
                if (e.event_token === 'tool_run') {
                    // Lazily initialize the list of origins
                    if (!GenePattern.stats.event_stats[e.event_token].origins)
                        GenePattern.stats.event_stats[e.event_token].origins = {};

                    // Parse the description and handle blanks
                    let [origin, id, tool] = e.description.split('|');
                    if (!origin) origin = 'unknown';
                    if (!tool) tool = 'unknown';

                    // Lazily initialize the specific origin
                    if (!GenePattern.stats.event_stats[e.event_token].origins[origin])
                        GenePattern.stats.event_stats[e.event_token].origins[origin] = {};

                    // Lazily initialize the specific tool or increment the count
                    if (!GenePattern.stats.event_stats[e.event_token].origins[origin][tool])
                        GenePattern.stats.event_stats[e.event_token].origins[origin][tool] = {count: 1}
                    else GenePattern.stats.event_stats[e.event_token].origins[origin][tool].count++;
                }

                // Special parsing for project_launch
                else if (e.event_token === 'project_launch') {
                    // Lazily initialize the list of users
                    if (!GenePattern.stats.event_stats[e.event_token].users)
                        GenePattern.stats.event_stats[e.event_token].users = {};

                    // Parse the description
                    const [user, project] = e.description.split('|');

                    // Lazily initialize the specific user
                    if (!GenePattern.stats.event_stats[e.event_token].users[user])
                        GenePattern.stats.event_stats[e.event_token].users[user] = {};

                    // Lazily initialize the specific project or increment the count
                    if (!GenePattern.stats.event_stats[e.event_token].users[user][project])
                        GenePattern.stats.event_stats[e.event_token].users[user][project] = {count: 1}
                    else GenePattern.stats.event_stats[e.event_token].users[user][project].count++;
                }

                // Special parsing for labextension_load
                else if (e.event_token === 'labextension_load') {
                    // Lazily initialize the list of domains
                    if (!GenePattern.stats.event_stats[e.event_token].domains)
                        GenePattern.stats.event_stats[e.event_token].domains = {};

                    // Parse the description
                    let url = null;
                    try { url = new URL(e.description); }
                    // Handle bad or misformatted URLs
                    catch (e) { url = { hostname: 'BAD URL' }; }

                    // Lazily initialize the specific domain or increment the count
                    if (!GenePattern.stats.event_stats[e.event_token].domains[url.hostname])
                        GenePattern.stats.event_stats[e.event_token].domains[url.hostname] = { count: 1 };
                    else GenePattern.stats.event_stats[e.event_token].domains[url.hostname].count++;
                }

                // Special parsing for nbextension_load
                else if (e.event_token === 'nbextension_load') {
                    // Lazily initialize the list of domains
                    if (!GenePattern.stats.event_stats[e.event_token].domains)
                        GenePattern.stats.event_stats[e.event_token].domains = {};

                    // Parse the description
                    let url = null;
                    try { url = new URL(e.description); }
                    // Handle bad or misformatted URLs
                    catch (e) { url = { hostname: 'BAD URL' }; }

                    // Lazily initialize the specific domain or increment the count
                    if (!GenePattern.stats.event_stats[e.event_token].domains[url.hostname])
                        GenePattern.stats.event_stats[e.event_token].domains[url.hostname] = { count: 1 };
                    else GenePattern.stats.event_stats[e.event_token].domains[url.hostname].count++;
                }

                // Handle other event_tokens
                else {
                    // Lazily initialize the list of descriptions
                    if (!GenePattern.stats.event_stats[e.event_token].descriptions)
                        GenePattern.stats.event_stats[e.event_token].descriptions = [];
                    // Append to the list
                    GenePattern.stats.event_stats[e.event_token].descriptions.push(e.description);
                }
            });

            // Ensure that the expected event types have at least been initialized
            if (!GenePattern.stats.event_stats['tool_run']) GenePattern.stats.event_stats['tool_run'] = { count: 0, origins: [] };
            if (!GenePattern.stats.event_stats['project_launch']) GenePattern.stats.event_stats['project_launch'] = { count: 0, users: [] };
            if (!GenePattern.stats.event_stats['labextension_load']) GenePattern.stats.event_stats['labextension_load'] = { count: 0, domains: [] };

            resolve();
        });
    }

    static draw_project_tables() {
        // Initialize the top projects table
        GenePattern.stats.project_runs.forEach(project => {
            const project_link = project.deleted ? `<del>${project.name}</del>` :
                `<a href="/hub/preview?id=${project.id}" target="_blank">${project.name}</a>`;
            $('#nb-most-copied').append(`<tr><td>${project_link}</td><td>${project.copied}</td></tr>`);
        });

        // Initialize the recent updates table
        GenePattern.stats.project_updates.forEach(update => {
            const project_link = update.project_deleted || !update.project ? `<del>${update.project}</del>` :
                `<a href="/hub/preview?id=${update.project_id}" target="_blank">${update.project}</a>`;
            $('#nb-latest-updates').append(`<tr><td>${project_link}</td><td>${update.comment}</td><td>${update.updated}</td></tr>`);
        });
    }

    static draw_events_table() {
        const alpha_sort = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
        const count_sort = (a, b) => a[1].count > b[1].count ? -1 : (a[1].count < b[1].count ? 1 : 0);

        // Initialize the tools section
        $('#nb-usage-tools-count').text(GenePattern.stats.event_stats['tool_run'].count);
        $('#nb-usage-tools-from').val(GenePattern.stats.event_stats['tool_run'].earliest?.toISOString().split('T')[0]);
        $('#nb-usage-tools-to').val(GenePattern.stats.event_stats['tool_run'].latest?.toISOString().split('T')[0]);
        for (const origin of Object.keys(GenePattern.stats.event_stats['tool_run'].origins).sort(alpha_sort)) {
            let tools_table = `<table class="table table-condensed"><tr><th>Tool</th><th class="nb-count">Count</th></tr>`;
            for (const [tool, value] of Object.entries(GenePattern.stats.event_stats['tool_run'].origins[origin]).sort(count_sort)) {
                tools_table += `<tr><td>${tool}</td><td>${value.count}</td></tr>`;
            }
            tools_table += '</table>';
            $('#nb-usage-tools').append(`<tr><td><strong>${origin}</strong></td><td class="nb-table-cell">${tools_table}</td></tr>`);
        }

        // Initialize the project launches section
        $('#nb-usage-launches-count').text(GenePattern.stats.event_stats['project_launch'].count);
        $('#nb-usage-launches-from').val(GenePattern.stats.event_stats['project_launch'].earliest?.toISOString().split('T')[0]);
        $('#nb-usage-launches-to').val(GenePattern.stats.event_stats['project_launch'].latest?.toISOString().split('T')[0]);
        for (const user of Object.keys(GenePattern.stats.event_stats['project_launch'].users).sort(alpha_sort)) {
            let projects_table = `<table class="table table-condensed"><tr><th>Project</th><th class="nb-count">Count</th></tr>`;
            for (const [slug, value] of Object.entries(GenePattern.stats.event_stats['project_launch'].users[user]).sort(count_sort)) {
                projects_table += `<tr><td>${slug}</td><td>${value.count}</td></tr>`;
            }
            projects_table += '</table>';
            $('#nb-usage-launches').append(`<tr><td><strong>${user}</strong></td><td class="nb-table-cell">${projects_table}</td></tr>`);
        }

        // Initialize labextension_load section
        $('#nb-usage-labext-count').text(GenePattern.stats.event_stats['labextension_load'].count);
        $('#nb-usage-labext-from').val(GenePattern.stats.event_stats['labextension_load'].earliest?.toISOString().split('T')[0]);
        $('#nb-usage-labext-to').val(GenePattern.stats.event_stats['labextension_load'].latest?.toISOString().split('T')[0]);
        for (const domain in GenePattern.stats.event_stats['labextension_load'].domains) {
            $('#nb-usage-labext').append(`<tr><td>${domain}</td><td>${GenePattern.stats.event_stats['labextension_load'].domains[domain].count}</td></tr>`);
        }

        // Initialize nbextension_load section
        $('#nb-usage-nbext-count').text(GenePattern.stats.event_stats['nbextension_load'].count);
        $('#nb-usage-nbext-from').val(GenePattern.stats.event_stats['nbextension_load'].earliest?.toISOString().split('T')[0]);
        $('#nb-usage-nbext-to').val(GenePattern.stats.event_stats['nbextension_load'].latest?.toISOString().split('T')[0]);
        for (const domain in GenePattern.stats.event_stats['nbextension_load'].domains) {
            $('#nb-usage-nbext').append(`<tr><td>${domain}</td><td>${GenePattern.stats.event_stats['nbextension_load'].domains[domain].count}</td></tr>`);
        }

        // Initialize the other events section
        const other_events = {};
        let total_count = 0;
        let overall_latest = new Date('2020-01-01');
        let overall_earliest = new Date();
        for (const token in GenePattern.stats.event_stats) {
            if (token !== 'tool_run' && token !== 'project_launch' && token !== 'labextension_load') {
                other_events[token] = GenePattern.stats.event_stats[token];
                total_count += GenePattern.stats.event_stats[token].count;
                if (GenePattern.stats.event_stats[token].latest > overall_latest)
                    overall_latest = GenePattern.stats.event_stats[token].latest;
                if (GenePattern.stats.event_stats[token].earliest < overall_earliest)
                    overall_earliest = GenePattern.stats.event_stats[token].earliest;
            }
        }
        $('#nb-usage-other-count').text(total_count);
        $('#nb-usage-other-from').val(overall_earliest?.toISOString().split('T')[0]);
        $('#nb-usage-other-to').val(overall_latest?.toISOString().split('T')[0]);
        for (const event_type in other_events) {
            $('#nb-usage-other').append(`<tr><td>${event_type}</td><td>${other_events[event_type].descriptions}</td>\<td>${other_events[event_type].count}</td><td>${other_events[event_type].latest.toUTCString()}</td></tr>`);
        }
    }
}

window.stats_page = new Stats();