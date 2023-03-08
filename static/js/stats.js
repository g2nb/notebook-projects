var GenePattern = GenePattern || {};
GenePattern.stats = GenePattern.stats || {};
GenePattern.stats.project_updates = GenePattern.stats.project_updates || {};
GenePattern.stats.project_runs = GenePattern.stats.project_runs || {};
GenePattern.stats.usage_events = GenePattern.stats.usage_events || {};

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
        Stats.query_usage_events().then(() => Stats.draw_events_table());
    }

    static query_usage_events() {
        return fetch(`/services/usage/report/`)
            .then(response => response.json())
            .then(response => {
                GenePattern.stats.usage_events = response['events'];
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