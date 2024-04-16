CREATE TABLE visited (
    id SERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);


CREATE TABLE unvisited (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);


CREATE TABLE problem (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);


CREATE TABLE host (
    id SERIAL PRIMARY KEY,
    host TEXT NOT NULL UNIQUE
);


CREATE TABLE xpath (
    id SERIAL PRIMARY KEY,
    xpath TEXT NOT NULL,
    hostid INTEGER NOT NULL,
    CONSTRAINT fk_host FOREIGN KEY (hostid) REFERENCES host(id),
    CONSTRAINT unique_host_xpath UNIQUE (hostid, xpath)
);
