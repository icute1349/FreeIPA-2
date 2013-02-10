/* 
 * Copyright (C) 2012 Bitergia
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 *
 * This file is a part of the VizGrimoireJS package
 *
 * Authors:
 *   Alvaro del Castillo San Felix <acs@bitergia.com>
 */

var Report = {};

(function() {

    // Shared config
    var project_data = null, markers = null, config = null, 
        data_callbacks = [], gridster = {}, data_sources = [], html_dir="";
    var data_dir = "data/json";
    var default_data_dir = "data/json";
    var default_html_dir = "";
    var projects_dirs = [default_data_dir];
    var projects_data = {};
    var projects_datasources = {};
    var project_file = data_dir + "/project-info.json",
        config_file = data_dir + "/viz_cfg.json",
        markers_file = data_dir + "/markers.json";
    var check_companies = false;

    // Public API
    Report.check_data_loaded = check_data_loaded;
    Report.convertBasicDivs = convertBasicDivs;
    Report.convertEnvision = convertEnvision;
    Report.convertFlotr2 = convertFlotr2;
    Report.convertTop = convertTop;
    Report.convertBubbles = convertBubbles;
    Report.convertDemographics = convertDemographics;
    Report.convertSelectors = convertSelectors;
    Report.createDataSources = createDataSources;
    Report.data_load = data_load;
    Report.data_ready = data_ready;
    Report.getAllMetrics = getAllMetrics;
    Report.getMarkers = getMarkers;
    Report.getConfig = getConfig;
    Report.getMetricDS = getMetricDS;
    Report.getGridster = getGridster;
    Report.setGridster = setGridster;
    Report.getProjectData = getProjectData;
    Report.getProjecstData = getProjectsData;
    Report.getBasicDivs = function() {
        return basic_divs;
    }; 
    Report.displayReportData = displayReportData;
    Report.report = report;
    Report.getDataSources = function() {
        // return data_sources.slice(0,3);
        return data_sources;
    };
    Report.registerDataSource = function(backend) {
        data_sources.push(backend);
    };
    
    Report.setHtmlDir = function (dir) {
        html_dir = dir;
    };

    Report.getDataDir = function() {
      return data_dir;
    };

    Report.setDataDir = function(dataDir) {
        data_dir = dataDir;
        project_file = dataDir + "/project-info.json", 
        config_file = dataDir + "/viz_cfg.json", 
        markers_file = dataDir + "/markers.json";
    };
   
    function getMarkers() {
        return markers;
    }

    function getConfig() {
        return config;
    }

    function getGridster() {
        return gridster;
    }

    function setGridster(grid) {
        gridster = grid;
    }

    function getProjectData() {
        return project_data;
    }
    
    function getProjectsData() {
        return projects_data;
    }
    
    Report.getProjectsDirs = function () {
        return projects_dirs;
    };
    
    Report.setProjectsDirs = function (dirs) {
        projects_dirs = dirs;
    };

    
    Report.getProjectsList = function () {
        var projects_list = [];
        for (key in getProjectsData()) {
            projects_list.push(key);
        }
        return projects_list;
    };
    
    Report.getProjectsDataSources = function () {
      return projects_datasources;
    };
    
    function getMetricDS(metric_id) {
        var ds = [];
        $.each(Report.getDataSources(), function(i, DS) {
            if (DS.getMetrics()[metric_id]) {
                ds.push(DS);
            }
        });
        return ds;
    }

    function data_ready(callback) {
        data_callbacks.push(callback);
    }

    function data_load() {
        data_load_file(project_file, function(data, self) {project_data = data;});
        data_load_file(config_file, function(data, self) {config = data;});
        data_load_file(markers_file, function(data, self) {markers = data;});        
        for (var i=0;  i<projects_dirs.length; i++) {
            var data_dir = projects_dirs[i];
            var prj_file = data_dir + "/project-info.json";
            data_load_file(prj_file, function(data, dir) {
                if (data.project_name === undefined) {
                    data.project_name = dir.replace("data/json","")
                        .replace(/\.\.\//g,"");
                }
                projects_data[data.project_name] = {dir:dir,url:data.project_url};
            }, data_dir);
        }
        data_load_companies();
        data_load_metrics();
        data_load_people();
        // data_load_tops('authors_rev');
        data_load_tops('authors');
    }

    function data_load_file(file, fn_data_set, self) {
        $.when($.getJSON(file)).done(function(history) {
            fn_data_set(history, self);
            end_data_load();
        }).fail(function() {
            fn_data_set([], self);
            end_data_load();
        });
    }

    function data_load_companies() {
        var data_sources = Report.getDataSources();
        $.each(data_sources, function(i, DS) {
            data_load_file(DS.getCompaniesDataFile(), DS.setCompaniesData, DS);
        });
    }

    // TODO: It is better to have all the tops in the same file
    function data_load_tops(metric) {
        var data_sources = Report.getDataSources();
        $.each(data_sources, function(i, DS) {
            // TODO: Support for SCM only in Webkit
            if (DS.getName() !== "scm") {
                DS.setGlobalTopData([], DS);
                return;
            }
            var file_static = DS.getDataDir() + "/"+ DS.getName()+"-top-"+metric;
            var file_all = file_static + ".json";
            var file_2006 = file_static + "_2006.json";
            var file_2009 = file_static + "_2009.json";
            var file_2012 = file_static + "_2012.json";
            $.when($.getJSON(file_all),
                    $.getJSON(file_2006),
                    $.getJSON(file_2009),
                    $.getJSON(file_2012)
                ).done(function(history, hist2006, hist2009, hist2012) {
                    DS.addGlobalTopData(history[0], DS, metric, "all");
                    DS.addGlobalTopData(hist2006[0], DS, metric, "2006");
                    DS.addGlobalTopData(hist2009[0], DS, metric, "2009");
                    DS.addGlobalTopData(hist2012[0], DS, metric, "2012");
                    end_data_load();
            }).fail(function() {
                DS.setGlobalTopData([], DS);
                end_data_load();
            });
        });
    }

    function data_load_companies_metrics() {
        var data_sources = Report.getDataSources();
        $.each(data_sources, function(i, DS) {
            var companies = DS.getCompaniesData();
            $.each(companies, function(i, company) {
                var file = DS.getDataDir()+"/"+company+"-";
                file_evo = file + DS.getName()+"-evolutionary.json";
                $.when($.getJSON(file_evo)).done(function(history) {
                    DS.addCompanyMetricsData(company, history, DS);
                    end_data_load();
                });
                file_static = file + DS.getName()+"-static.json";
                $.when($.getJSON(file_static)).done(function(history) {
                    DS.addCompanyGlobalData(company, history, DS);
                    end_data_load();
                });
                file_static = file + DS.getName()+"-top-authors";
                var file_all = file_static + ".json";
                var file_2006 = file_static + "_2006.json";
                var file_2009 = file_static + "_2009.json";
                var file_2012 = file_static + "_2012.json";
                $.when($.getJSON(file_all),
                        $.getJSON(file_2006),
                        $.getJSON(file_2009),
                        $.getJSON(file_2012)
                    ).done(function(history, hist2006, hist2009, hist2012) {
                        DS.addCompanyTopData(company, history[0], DS, "all");
                        DS.addCompanyTopData(company, hist2006[0], DS, "2006");
                        DS.addCompanyTopData(company, hist2009[0], DS, "2009");
                        DS.addCompanyTopData(company, hist2012[0], DS, "2012");
                        end_data_load();
                }).fail(function() {
                    DS.setCompaniesTopData([], self);
                    end_data_load();
                });
            });
        });
    }

    function data_load_metrics() {
        var data_sources = Report.getDataSources();
        $.each(data_sources, function(i, DS) {
            data_load_file(DS.getDataFile(), DS.setData, DS);
            data_load_file(DS.getGlobalDataFile(), DS.setGlobalData, DS);
            // TODO: Demographics just for SCM yet!
            if (DS instanceof SCM) {
                data_load_file(DS.getDemographicsFile(), DS.setDemographicsData, DS);
            }
            if (DS instanceof MLS) {
                data_load_file(DS.getListsFile(), DS.setListsData, DS);
            }

        });
    }
    
    function data_load_people() {
        $.each(data_sources, function(i, DS) {
            data_load_file(DS.getPeopleDataFile(), DS.setPeopleData, DS);
        });
    }

    function check_data_loaded() {
        var check = true;
        if (project_data === null || config === null || markers === null) 
            return false;
        
        var projects_loaded = 0;        
        for (var key in projects_data) {projects_loaded++;}
        if (projects_loaded < projects_dirs.length ) return false;
        
        var data_sources = Report.getDataSources();        
        $.each(data_sources, function(index, DS) {
            if (DS.getData() === null) {check = false; return false;}
            if (DS.getGlobalData() === null) {check = false; return false;}
            if (DS.getPeopleData() === null) {check = false; return false;}
            if (DS.getCompaniesData() === null) {check = false; return false;}
            if (DS.getGlobalTopData() === null) {check = false; return false;}
            else {
                if (DS.getCompaniesData().length>0 && !check_companies) {
                    check_companies = true;
                    data_load_companies_metrics();
                    check = false; return false;
                }
            }
            if (check_companies && DS.getCompaniesData().length>0) {
                var companies_loaded = 0;
                for (var key in DS.getCompaniesMetricsData()) {companies_loaded++;}
                if (companies_loaded !== DS.getCompaniesData().length)
                    {check = false; return false;}
                companies_loaded = 0;
                for (var key in DS.getCompaniesGlobalData()) {companies_loaded++;}
                if (companies_loaded !== DS.getCompaniesData().length)
                    {check = false; return false;}
                if (DS.getCompaniesTopData() === null) {check = false; return false;}
                companies_loaded = 0;
                for (var key in DS.getCompaniesTopData()) {companies_loaded++;}
                if (companies_loaded !== DS.getCompaniesData().length)
                    {check = false; return false;}
            }
            // TODO: Demographics just for SCM yet!
            if (DS instanceof SCM) {
                if (DS.getDemographicsData() === null) {check = false; return false;} 
            }
            if (DS instanceof MLS) {
                if (DS.getListsData() === null) {check = false; return false;}
            }
        });         
        return check;
    }

    function end_data_load() {        
        if (check_data_loaded()) {
            // Invoke callbacks informing all data needed has been loaded
            for ( var i = 0; i < data_callbacks.length; i++) {
                data_callbacks[i]();
            }
        }
    }

    function getAllMetrics() {
        var all = {};
        $.each(Report.getDataSources(), function(index, DS) {
            all = $.extend({}, all, DS.getMetrics());
        });
        return all;
    }

    function displayReportData() {
        data = project_data;
        document.title = data.project_name + ' Report by Bitergia';
        $(".report_date").text(data.date);
        $(".report_name").text(data.project_name);
        str = data.blog_url;
        if (str && str.length > 0) {
            $('#blogEntry').html(
                    "<br><a href='" + str
                            + "'>Blog post with some more details</a>");
            $('.blog_url').attr("href", data.blog_url);
        } else {
            $('#more_info').hide();
        }
        str = data.producer;
        if (str && str.length > 0) {
            $('#producer').html(str);
        } else {
            $('#producer').html("<a href='http://bitergia.com'>Bitergia</a>");
        }
    }

    function checkDynamicConfig() {
        var data_sources = [];
        
        function getDataDirs(dirs_config) {
            var full_params = dirs_config.split ("&");
            var dirs_param = $.grep(full_params,function(item, index) {
                return (item.indexOf("data_dir=") === 0);
            });
            for (var i=0; i< dirs_param.length; i++) {                
                var data_dir = dirs_param[i].split("=")[1];
                data_sources.push(data_dir);
                if (i === 0) Report.setDataDir(data_dir);
            }             
        }
        
        var querystr = window.location.search.substr(1);
        // Config in GET URL
        if (querystr && querystr.indexOf("data_dir")>=0) {
            getDataDirs(querystr);
            if (data_sources.length>0)
                Report.setProjectsDirs(data_sources);
        }
    }
    
    function createDataSources() {
        checkDynamicConfig();
        
        var projects_dirs = Report.getProjectsDirs(); 

        $.each(projects_dirs, function (i, project) {
            // TODO: Only DS with data should exist
            var its = new ITS();
            Report.registerDataSource(its);
            var mls = new MLS();        
            Report.registerDataSource(mls);        
            var scm = new SCM();
            Report.registerDataSource(scm);
        
            its.setDataDir(project);
            mls.setDataDir(project);
            scm.setDataDir(project);   
        });
        
        return true;
    }
        
    var basic_divs = {
        "navigation": {
            convert: function() {
                $.get(html_dir+"navigation.html", function(navigation) {
                    $("#navigation").html(navigation);
                    var querystr = window.location.search.substr(1);
                    if (querystr && querystr.indexOf("data_dir")!==-1) {
                        var $links = $("#navigation a");
                        $.each($links, function(index, value){
                            value.href += "?"+window.location.search.substr(1);
                        });
                    }
                });                
            }
        },
        "header": {
            convert: function() {
                $.get(html_dir+"header.html", function(header) {
                    $("#header").html(header);
                    displayReportData();
                    var querystr = window.location.search.substr(1);
                    if (querystr && querystr.indexOf("data_dir")!==-1) {
                        var $links = $("#header a");
                        $.each($links, function(index, value){
                            value.href += "?"+window.location.search.substr(1);
                        });
                    }
                });
            }
        },
        "footer": {
            convert: function() {
                $.get(html_dir+"footer.html", function(footer) {
                    $("#footer").html(footer);
                });
            }
        },
        // Reference card with info from all data sources
        "refcard": {
            convert: function() {
                $.when($.get(html_dir+"refcard.html"), 
                        $.get(html_dir+"project-card.html"))
                .done (function(res1, res2) {
                    refcard = res1[0];
                    projcard = res2[0];

                    $("#refcard").html(refcard);
                    displayReportData();
                    $.each(getProjectsData(), function(prj_name, prj_data) {
                        var new_div = "card-"+prj_name.replace(".","").replace(" ","");
                        $("#refcard #projects_info").append(projcard);
                        $("#refcard #projects_info #new_card")
                            .attr("id", new_div);
                        $.each(data_sources, function(i, DS) {
                            if (DS.getProject() !== prj_name) {
                                $("#" + new_div + ' .'+DS.getName()+'-info').hide();
                                return;
                            }
                            DS.displayData(new_div);
                        });
                        $("#"+new_div+" #project_name").text(prj_name);
                        if (projects_dirs.length>1)
                            $("#"+new_div+" .project_info")
                                .append(' <a href="VizGrimoireJS/browser/index.html?data_dir=../../'+prj_data.dir+'">Report</a>');
                        
                        $("#"+new_div+" #project_url")
                            .attr("href", prj_data.url);

                    });
                });
            }
        },
        "radar-activity": {
            convert: function() {
                Viz.displayRadarActivity('radar-activity');
            }
        },
        "radar-community": {
            convert: function() {
                Viz.displayRadarCommunity('radar-community');
            }
        },
        "gridster": {
            convert: function() {
                var gridster = $("#gridster").gridster({
                    widget_margins : [ 10, 10 ],
                    widget_base_dimensions : [ 140, 140 ]
                }).data('gridster');
    
                Report.setGridster(gridster);
                gridster.add_widget("<div id='metric_selector'></div>", 1, 3);
                Viz.displayGridMetricSelector('metric_selector');
                Viz.displayGridMetricAll(true);
            }
        },
        "treemap": {
            convert: function() {
                var file = $('#treemap').data('file');
                Viz.displayTreeMap('treemap', file);
            }
        }
    };

    // TODO: Move more company div's here from flotr2?
    function convertCompanies() {
        $.each(Report.getDataSources(), function(index, DS) {
            var divid = DS.getName()+"-companies-summary";
            if ($("#"+divid).length > 0) {
                DS.displayCompaniesSummary(divid, this);
            }
        });

        var company = null;
        var querystr = window.location.search.substr(1);
        if (querystr  &&
                querystr.split("&")[0].split("=")[0] === "company")
            company = querystr.split("&")[0].split("=")[1];

        if (company === null) return;

        $.each(Report.getDataSources(), function(index, DS) {
            if (DS.getName() !== "scm") return;
            var divid = DS.getName()+"-refcard-company";
            if ($("#"+divid).length > 0) {
                DS.displayCompanySummary(divid, company, this);
            }
        });
    }
    
    function convertFlotr2(config) {        
        // General config for metrics viz
        var config_metric = {};
                
        config_metric.show_desc = false;
        config_metric.show_title = false;
        config_metric.show_labels = true;

        if (config) {
            $.each(config, function(key, value) {
                config_metric[key] = value;
            });
        }
        
        var already_shown = [];
        var metric_already_shown = [];
        $.each(Report.getDataSources(), function(index, DS) {
            if (DS.getData().length === 0) return;
            $.each(DS.getMetrics(), function(i, metric) {
                var div_flotr2 = metric.divid+"-flotr2";
                if ($("#"+div_flotr2).length > 0 &&
                        $.inArray(metric.column, metric_already_shown) === -1) {
                    DS.displayBasicMetricHTML(i,div_flotr2, config_metric);
                    metric_already_shown.push(metric.column);
                }
                // Getting data real time
                var div_flotr2_rt = metric.divid+"-flotr2-rt";
                if ($("#"+div_flotr2_rt).length > 0) {
                    config_metric.realtime = true;
                    config_metric.json_ds = "http://localhost:1337/?callback=?";
                    DS.displayBasicMetricHTML(i,div_flotr2_rt, config_metric);
                }
            });
            
            if ($("#"+DS.getName()+"-flotr2").length > 0) {
                if ($.inArray(DS.getName(), already_shown) === -1) {
                    DS.displayBasicHTML(DS.getName()+'-flotr2', config_metric);
                    already_shown.push(DS.getName());
                }
            }
            
            if (DS instanceof MLS) {
                if ($("#"+DS.getName()+"-flotr2"+"-lists").length > 0) {
                    if (Report.getProjectsList().length === 1)
                        DS.displayBasic
                            (DS.getName() + "-flotr2"+"-lists", config_metric);
                }
            }

            // Multiparam
            var div_param = DS.getName()+"-flotr2-metrics";
            var divs = $("."+div_param);
            if (divs.length > 0) {
                $.each(divs, function(id, div) {
                    var metrics = $(this).data('metrics');
                    config.show_legend = false;
                    if ($(this).data('legend'))
                        config_metric.show_legend = true;
                    div.id = metrics.replace(/,/g,"-")+"-flotr2-metrics";
                    DS.displayBasicMetrics(metrics.split(","),div.id,
                            config_metric);
                });
            }

            // Companies
            var div_companies = DS.getName()+"-flotr2-companies";
            var divs = $("."+div_companies);
            if (divs.length > 0) {
                $.each(divs, function(id, div) {
                    var metric = $(this).data('metric');
                    var limit = $(this).data('limit');
                    var order_by = $(this).data('order-by');
                    var stacked = false;
                    if ($(this).data('stacked')) stacked = true;
                    config_metric.lines = {stacked : stacked};
                    div.id = metric+"-flotr2-companies";
                    DS.displayBasicMetricCompanies(metric,div.id,
                            config_metric, limit, order_by);
                });
            }
            var div_companies = DS.getName()+"-flotr2-companies-static";
            var divs = $("."+div_companies);
            if (divs.length > 0) {
                $.each(divs, function(id, div) {
                    var metric = $(this).data('metric');
                    var order_by = $(this).data('order-by');
                    var limit = $(this).data('limit');
                    var show_others = $(this).data('show-others');
                    config_metric.graph = $(this).data('graph');
                    div.id = metric+"-flotr2-companies-static";
                    DS.displayBasicMetricCompaniesStatic(metric,div.id,
                            config_metric, limit, order_by, show_others);
                });
            }
            var company = null;
            var querystr = window.location.search.substr(1);
            if (querystr  &&
                    querystr.split("&")[0].split("=")[0] === "company")
                company = querystr.split("&")[0].split("=")[1];
            var div_company = DS.getName()+"-flotr2-metrics-company";
            var divs = $("."+div_company);
            if (divs.length > 0 && company) {
                $.each(divs, function(id, div) {
                    var metrics = $(this).data('metrics');
                    config.show_legend = false;
                    if ($(this).data('legend')) config_metric.show_legend = true;
                    div.id = metrics.replace(/,/g,"-")+"-flotr2-metrics-company";
                    DS.displayBasicMetricsCompany(company, metrics.split(","),
                            div.id, config_metric);
                });
            }

            var div_nav = DS.getName()+"-flotr2-companies-nav";
            if ($("#"+div_nav).length > 0) {
                var metric = $("#"+div_nav).data('sort-metric');
                DS.displayCompaniesNav(div_nav, metric);
            }
            var divs_comp_list = DS.getName()+"-flotr2-companies-list";
            var divs = $("."+divs_comp_list);
            if (divs.length > 0) {
                $.each(divs, function(id, div) {
                    var metrics = $(this).data('metrics');
                    var sort_metric = $(this).data('sort-metric');
                    div.id = metrics.replace(/,/g,"-")+"-flotr2-companies-list";
                    DS.displayCompaniesList(metrics.split(","),div.id,
                            config_metric, sort_metric);
                });
            }

            var div_companies = DS.getName()+"-flotr2-top-company";
            var divs = $("."+div_companies);
            if (divs.length > 0) {
                $.each(divs, function(id, div) {
                    var metric = $(this).data('metric');
                    var period = $(this).data('period');
                    var titles = $(this).data('titles');
                    div.id = metric+"-"+period+"-flotr2-top-company";
                    div.className = "";
                    DS.displayTopCompany(company,div.id,metric,period,titles);
                });
            }
        });
    }

    function convertEnvision() {
        if ($("#all-envision").length > 0) {
            var relative = $('#all-envision').data('relative');
            Viz.displayEvoSummary('all-envision', relative);
        }
        var already_shown = [];
        $.each(Report.getDataSources(), function(index, DS) {
            if (DS.getData().length === 0) return;
            var div_envision = DS.getName() + "-envision";
            if ($("#" + div_envision).length > 0) {
                if ($.inArray(DS.getName(), already_shown) !== -1)
                    return;
                var relative = $('#'+div_envision).data('relative');
                if (DS instanceof MLS) {
                    DS.displayEvo(div_envision, relative);
                    // DS.displayEvoAggregated(div_envision);
                    if (Report.getProjectsList().length === 1)
                        if ($("#" + DS.getName() + "-envision"+"-lists").length > 0)
                            DS.displayEvoListsMain
                                (DS.getName() + "-envision"+"-lists");
                } else if ($.inArray(DS.getName(), already_shown) === -1) { 
                    DS.displayEvo(div_envision, relative); 
                }
                already_shown.push(DS.getName());
            }
        });
    }

    function convertIdentity() {
        $.each(Report.getDataSources(), function(index, DS) {
            var divid = DS.getName()+"-people";
            if ($("#"+divid).length > 0) {
                Identity.showList(divid, DS);
            }
        });
        if ($("#unique-people").length > 0)
            Identity.showListNested("unique-people");
    }
    
    function convertTop() {
        $.each(Report.getDataSources(), function(index, DS) {
            if (DS.getData().length === 0) return;

            var div_id_top = DS.getName()+"-top";
            var show_all = false;
            
            if ($("#"+div_id_top).length > 0) {
                if ($("#"+div_id_top).data('show_all')) show_all = true;
                DS.displayTop(div_id_top, show_all);
            }           
            $.each(['pie','bars'], function (index, chart) {
                var div_id_top = DS.getName()+"-top-"+chart;
                if ($("#"+div_id_top).length > 0) {
                    if ($("#"+div_id_top).data('show_all')) show_all = true;
                    DS.displayTop(DS.getName()+'-top-'+ chart, show_all, chart);
                }
            });
            
            var div_tops = DS.getName()+"-global-top-metric";
            var divs = $("."+div_tops);
            if (divs.length > 0) {
                $.each(divs, function(id, div) {
                    var metric = $(this).data('metric');
                    var period = $(this).data('period');
                    var titles = $(this).data('titles');
                    div.id = metric.replace("_","-")+"-"+period+"-global-metric";
                    DS.displayTopGlobal(div.id, metric, period, titles);
                });
            }
        });
    }
    
    function convertBubbles() {
        $.each(Report.getDataSources(), function(index, DS) {
            if (DS.getData().length === 0) return;

            var div_time = DS.getName() + "-time-bubbles";
            if ($("#" + div_time).length > 0)
                DS.displayBubbles(div_time);
        });        
    }
    
    function convertDemographics() {
        $.each(Report.getDataSources(), function(index, DS) {
            var div_demog = DS.getName() + "-demographics";
            if ($("#" + div_demog).length > 0)
                DS.displayDemographics(div_demog);
            // Specific demographics loaded from files
            var divs = $('[id^="' + DS.getName() + '-demographics"]');
            for ( var i = 0; i < divs.length; i++) {
                var file = $(divs[i]).data('file');
                DS.displayDemographics(divs[i].id, file);
            }
        });
    }
    
    function convertSelectors() {       
        // Selectors
        $.each(Report.getDataSources(), function(index, DS) {
            var div_selector = DS.getName() + "-selector";
            var div_envision = DS.getName() + "-envision-lists";
            var div_flotr2 = DS.getName() + "-flotr2-lists";
            if ($("#" + div_selector).length > 0)
                // TODO: Only MLS supported 
                if (DS instanceof MLS) {
                    DS.displayEvoBasicListSelector(div_selector, div_envision,
                            div_flotr2);
                }
        });
    }
    
    function convertBasicDivs() {
        $.each (basic_divs, function(divid, value) {
            if ($("#"+divid).length > 0) value.convert(); 
        });
    }
    
    function configDataSources() {
        var prjs_dss = Report.getProjectsDataSources();
        $.each(Report.getDataSources(), function (index, ds) {
            if (ds.getData() instanceof Array) return;
            $.each(projects_data, function (name, project) {
                if (project.dir === ds.getDataDir()) {                    
                    if (prjs_dss[name] === undefined) prjs_dss[name] = [];
                    ds.setProject(name);
                    prjs_dss[name].push(ds);
                    return false;
                }
            });            
        });
        
    }
    
    Report.setConfig = function (data) {
        if (data) {
            if (data['global-html-dir'])
                Report.setHtmlDir(data['global-html-dir']);
            if (data['global-data-dir'])
                Report.setDataDir(data['global-data-dir']);
            if (data['projects-data-dirs'])
                Report.setProjectsDirs(data['projects-data-dirs']);
        }
    };
           

    function report() {
        configDataSources();
        convertBasicDivs();
        convertBubbles();        
        convertCompanies();
        convertDemographics();
        convertEnvision();
        convertFlotr2(config);
        // TODO: Create a new class for Identity?
        convertIdentity();
        convertSelectors();
        convertTop();
    }
})();

Report.data_ready(function() {
    Report.report();
    $("body").css("cursor", "auto");
});

$(document).ready(function() {
    $.getJSON('config.json', function(data) {
        Report.setConfig(data);
    }).always(function (data) {
        Report.createDataSources();
        Report.data_load();
        $("body").css("cursor", "progress");
    });
});