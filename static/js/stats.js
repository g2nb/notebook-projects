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
        Stats.query_usage_events().then(() => Stats.compile_usage_stats().then(() => Stats.draw_events_table()));
    }

    static query_usage_events() {
        return fetch(`https://workspace.g2nb.org/services/usage/report/`)
            .then(response => response.json())
            .then(response => {
                GenePattern.stats.usage_events = response['events'];
            });
    }

    static compile_usage_stats() {
        return new Promise((resolve, reject) => {
            GenePattern.stats.usage_events.forEach(e => {
                if (e.event_token === '') e.event_token = 'unknown'; // Special case for unknown tokens

                // Lazily initialize event_stats and increment counts for each event_token
                if (e.event_token in GenePattern.stats.event_stats) GenePattern.stats.event_stats[e.event_token].count++;
                else GenePattern.stats.event_stats[e.event_token] = {count: 1};

                // Note the latest time the event happened
                const created = new Date(e.created);
                if (!GenePattern.stats.event_stats[e.event_token].latest)
                    GenePattern.stats.event_stats[e.event_token].latest = created;
                else if (GenePattern.stats.event_stats[e.event_token].latest < created)
                    GenePattern.stats.event_stats[e.event_token].latest = created;

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
                    const url = new URL(e.description)

                    // Lazily initialize the specific domain or increment the count
                    if (!GenePattern.stats.event_stats[e.event_token].domains[url.hostname])
                        GenePattern.stats.event_stats[e.event_token].domains[url.hostname] = {count: 1};
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
        // Initialize the usage events table
        GenePattern.stats.usage_events.forEach(event => {
            $('#nb-usage-events').append(`<tr><td>${event.event_token}</td><td>${event.description}</td><td>${event.created}</td></tr>`);
        });
    }
}

window.stats_page = new Stats();