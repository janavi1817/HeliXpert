import pandas as pd
import sqlite3
import os
import json
import logging
import h5py
import numpy as np
from datetime import datetime

# Setup paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROCESSED_DIR = os.path.join(DATA_DIR, 'processed')
DB_PATH = os.path.join(DATA_DIR, 'database', 'helixpert.db')
METADATA_DIR = os.path.join(DATA_DIR, 'metadata')

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(METADATA_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def create_database_schema(conn):
    """Create optimized database schema for all datasets"""
    cursor = conn.cursor()
    
    # Dataset sources table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS dataset_sources (
            source_id TEXT PRIMARY KEY,
            dataset_name TEXT NOT NULL,
            provider TEXT,
            source_url TEXT,
            license TEXT,
            description TEXT,
            dataset_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Helicopters table (Real helicopter master data)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS helicopters (
            helicopter_id TEXT PRIMARY KEY,
            model TEXT,
            manufacturer TEXT,
            variant TEXT,
            helicopter_type TEXT,
            rotor_configuration TEXT,
            country TEXT,
            data_status TEXT,
            source_id TEXT,
            FOREIGN KEY (source_id) REFERENCES dataset_sources(source_id)
        )
    """)
    
    # Components table (Real component/IPC data)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS components (
            component_id TEXT PRIMARY KEY,
            component_type TEXT,
            component_name TEXT,
            description TEXT,
            source_type TEXT,
            helicopter_id TEXT,
            FOREIGN KEY (helicopter_id) REFERENCES helicopters(helicopter_id)
        )
    """)
    
    # PHM Helicopter Engine Parameters (Real PHM dataset)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sensor_parameters (
            id INTEGER PRIMARY KEY,
            trq_measured REAL,
            oat REAL,  -- Outside Air Temperature
            mgt REAL,  -- Mean Gas Temperature  
            pa REAL,   -- Pressure Altitude
            ias REAL,  -- Indicated Airspeed
            np REAL,   -- Power Turbine Speed
            ng REAL,   -- Gas Generator Speed
            faulty INTEGER,  -- Health label: 0=healthy, 1=faulty
            trq_margin REAL,
            dataset_id TEXT DEFAULT 'PHM_HELICOPTER_ENGINE',
            source_id TEXT,
            FOREIGN KEY (source_id) REFERENCES dataset_sources(source_id)
        )
    """)
    
    # Maintenance Records (Real annotated logbook)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS maintenance_records (
            maintenance_id INTEGER PRIMARY KEY AUTOINCREMENT,
            IDENT TEXT,
            PROBLEM TEXT,
            PROBLEM_TYPE TEXT,
            LOCATION TEXT,
            PROBLEM_PART TEXT,
            TAGGEDPROBLEM TEXT,
            EFFECT TEXT,
            ACTION TEXT,
            ACTION_TYPE TEXT,
            INSTALL_REPLACE_WITH TEXT,
            ACTION_PART TEXT,
            TAGGEDACTION TEXT,
            CAUSE TEXT,
            dataset_id TEXT DEFAULT 'AVIATION_MAINTENANCE',
            source_id TEXT,
            FOREIGN KEY (source_id) REFERENCES dataset_sources(source_id)
        )
    """)
    
    # NASA C-MAPSS Observations (Separate turbofan prognostics dataset)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cmapss_observations (
            cmapss_id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_name TEXT,  -- e.g., 'N-CMAPSS_DS01-005'
            engine_unit INTEGER,
            cycle INTEGER,
            operational_condition_1 REAL,
            operational_condition_2 REAL,
            operational_condition_3 REAL,
            sensor_1 REAL,   -- Temperature parameters
            sensor_2 REAL,
            sensor_3 REAL,
            sensor_4 REAL,
            sensor_5 REAL,
            sensor_6 REAL,
            sensor_7 REAL,
            sensor_8 REAL,
            sensor_9 REAL,
            sensor_10 REAL,
            sensor_11 REAL,
            sensor_12 REAL,
            sensor_13 REAL,
            sensor_14 REAL,
            sensor_15 REAL,
            sensor_16 REAL,
            sensor_17 REAL,
            sensor_18 REAL,
            sensor_19 REAL,
            sensor_20 REAL,
            rul REAL,         -- Remaining Useful Life (if available)
            dataset_id TEXT DEFAULT 'NASA_CMAPSS',
            source_id TEXT,
            FOREIGN KEY (source_id) REFERENCES dataset_sources(source_id)
        )
    """)
    
    # Fault/Health summary (derived from datasets)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS faults_summary (
            fault_id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id TEXT,
            observation_id INTEGER,
            fault_type TEXT,
            health_state TEXT,
            confidence REAL,
            detection_method TEXT,
            source_id TEXT,
            FOREIGN KEY (source_id) REFERENCES dataset_sources(source_id)
        )
    """)
    
    # Create indexes for performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sensor_faulty ON sensor_parameters(faulty)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cmapss_engine ON cmapss_observations(engine_unit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cmapss_dataset ON cmapss_observations(dataset_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_maintenance_type ON maintenance_records(PROBLEM_TYPE)")
    
    conn.commit()
    logging.info("Database schema created successfully")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    create_database_schema(conn)
    return conn

def ingest_helicopters(conn):
    logging.info("Ingesting Real Helicopter Master Dataset...")
    file_path = os.path.join(RAW_DIR, 'helicopters', 'helicopters.csv')
    if not os.path.exists(file_path):
        logging.warning(f"File not found: {file_path}")
        return None
        
    # Insert dataset source information
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO dataset_sources 
        (source_id, dataset_name, provider, source_url, license, description, dataset_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        'HELICOPTER_MASTER',
        'Helicopter Master Reference Dataset',
        'Verified Public Sources',
        'Multiple verified aviation sources',
        'Public Domain',
        'Real helicopter specifications and reference data - verified public information',
        'Helicopter Intelligence'
    ))
    
    df = pd.read_csv(file_path)
    # Add source_id to dataframe
    df['source_id'] = 'HELICOPTER_MASTER'
    df.to_sql('helicopters', conn, if_exists='replace', index=False)
    conn.commit()
    
    logging.info(f"Successfully ingested {len(df)} helicopter records")
    return {"records": len(df), "columns": len(df.columns)}

def ingest_components(conn):
    logging.info("Ingesting Component Reference Dataset...")
    file_path = os.path.join(RAW_DIR, 'components', 'components_reference.csv')
    if not os.path.exists(file_path):
        logging.warning(f"File not found: {file_path}")
        return None
        
    # Insert dataset source information
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO dataset_sources 
        (source_id, dataset_name, provider, source_url, license, description, dataset_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        'HELICOPTER_COMPONENTS',
        'Helicopter Component Reference Taxonomy',
        'Reference Taxonomy',
        'Internal reference compilation',
        'Reference Use',
        'General helicopter component taxonomy - not official IPC data',
        'Helicopter Components'
    ))
    
    df = pd.read_csv(file_path)
    df.to_sql('components', conn, if_exists='replace', index=False)
    conn.commit()
    
    logging.info(f"Successfully ingested {len(df)} component references")
    return {"records": len(df), "columns": len(df.columns)}

def ingest_maintenance(conn):
    logging.info("Ingesting Annotated Aviation Maintenance Logbook Dataset...")
    file_path = os.path.join(RAW_DIR, 'maintenance', 'ANNOTATED LOGBOOK.csv')
    if not os.path.exists(file_path):
        logging.warning(f"File not found: {file_path}")
        return None
        
    # Insert dataset source information
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO dataset_sources 
        (source_id, dataset_name, provider, source_url, license, description, dataset_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        'AVIATION_MAINTENANCE',
        'Annotated Aviation Maintenance Logbook',
        'Aviation Maintenance Dataset',
        'Annotated maintenance records dataset',
        'Dataset License',
        'Real annotated aviation maintenance logbook with problem/action/cause analysis',
        'Aviation Maintenance'
    ))
    
    df = pd.read_csv(file_path)
    # Clean up column names
    df.columns = [c.strip().replace(" ", "_").replace("/", "_") for c in df.columns]
    # Add source_id
    df['source_id'] = 'AVIATION_MAINTENANCE'
    df.to_sql('maintenance_records', conn, if_exists='replace', index=False)
    
    # Create FTS for maintenance search
    try:
        cursor.execute("DROP TABLE IF EXISTS maintenance_search")
        cursor.execute("""
            CREATE VIRTUAL TABLE maintenance_search USING fts5(
                IDENT, PROBLEM, PROBLEM_TYPE, LOCATION, PROBLEM_PART,
                TAGGEDPROBLEM, EFFECT, ACTION, ACTION_TYPE, INSTALL_REPLACE_WITH,
                ACTION_PART, TAGGEDACTION, CAUSE
            );
        """)
        
        cursor.execute("""
            INSERT INTO maintenance_search 
            SELECT IDENT, PROBLEM, PROBLEM_TYPE, LOCATION, PROBLEM_PART,
                   TAGGEDPROBLEM, EFFECT, ACTION, ACTION_TYPE, INSTALL_REPLACE_WITH,
                   ACTION_PART, TAGGEDACTION, CAUSE 
            FROM maintenance_records
        """)
        conn.commit()
        logging.info("Created full-text search index for maintenance records")
    except Exception as e:
        logging.error(f"FTS error: {e}")
        
    logging.info(f"Successfully ingested {len(df)} maintenance records")
    return {"records": len(df), "columns": len(df.columns)}

def ingest_phm_engine(conn):
    logging.info("Ingesting PHM 2024 Helicopter Turboshaft Engine Dataset...")
    base_path = os.path.join(RAW_DIR, 'phm_helicopter')
    
    xtrain_path = os.path.join(base_path, 'X_train.csv')
    ytrain_path = os.path.join(base_path, 'y_train.csv')
    
    if not os.path.exists(xtrain_path):
        logging.warning("PHM 2024 helicopter dataset not found.")
        return None
    
    # Insert dataset source information
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO dataset_sources 
        (source_id, dataset_name, provider, source_url, license, description, dataset_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        'PHM_HELICOPTER_ENGINE',
        'PHM 2024 Helicopter Turboshaft Engine Health Dataset',
        'PHM North America 2024',
        'PHM Conference 2024 Challenge Dataset',
        'Challenge Dataset License',
        'Real helicopter turboshaft engine health monitoring dataset with fault detection labels',
        'Helicopter Engine Health'
    ))
    
    df_x = pd.read_csv(xtrain_path)
    
    # Merge with labels if available
    if os.path.exists(ytrain_path):
        df_y = pd.read_csv(ytrain_path)
        if 'id' in df_x.columns and 'id' in df_y.columns:
            df = pd.merge(df_x, df_y, on='id')
        elif 'ID' in df_x.columns and 'ID' in df_y.columns:
            df = pd.merge(df_x, df_y, on='ID')
        else:
            # Assume same order and concatenate
            df = pd.concat([df_x, df_y], axis=1)
        logging.info("Merged X_train.csv with y_train.csv")
    else:
        df = df_x
        logging.warning("y_train.csv not found, proceeding without health labels")
    
    # Add source tracking
    df['source_id'] = 'PHM_HELICOPTER_ENGINE'
    df.to_sql('sensor_parameters', conn, if_exists='replace', index=False)
    conn.commit()
    
    # Generate fault summary if health labels are available
    if 'faulty' in df.columns:
        fault_summary = []
        for _, row in df.iterrows():
            if pd.notna(row.get('faulty')):
                fault_summary.append({
                    'dataset_id': 'PHM_HELICOPTER_ENGINE',
                    'observation_id': row.get('id', row.name),
                    'fault_type': 'Engine Health',
                    'health_state': 'Faulty' if row['faulty'] == 1 else 'Healthy',
                    'confidence': 1.0,  # Dataset labels are definitive
                    'detection_method': 'PHM Dataset Label',
                    'source_id': 'PHM_HELICOPTER_ENGINE'
                })
        
        if fault_summary:
            pd.DataFrame(fault_summary).to_sql('faults_summary', conn, if_exists='replace', index=False)
            logging.info(f"Generated {len(fault_summary)} fault summary records")
    
    logging.info(f"Successfully ingested {len(df)} PHM helicopter engine observations")
    return {"records": len(df), "columns": len(df.columns)}

def ingest_cmapss(conn):
    """Ingest NASA C-MAPSS turbofan engine degradation datasets"""
    logging.info("Ingesting NASA C-MAPSS Turbofan Engine Degradation Dataset...")
    base_path = os.path.join(RAW_DIR, 'cmapss')
    
    if not os.path.exists(base_path):
        logging.warning("CMAPSS dataset directory not found.")
        return None
    
    h5_files = [f for f in os.listdir(base_path) if f.endswith('.h5')]
    
    if not h5_files:
        logging.warning("No CMAPSS H5 files found.")
        return None
    
    total_records = 0
    processed_datasets = []
    
    # Insert dataset source information
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO dataset_sources 
        (source_id, dataset_name, provider, source_url, license, description, dataset_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        'NASA_CMAPSS',
        'NASA C-MAPSS Turbofan Engine Degradation',
        'NASA Ames Research Center',
        'https://www.nasa.gov/content/prognostics-center-of-excellence-data-set-repository',
        'Public Domain',
        'Turbofan engine degradation simulation dataset for prognostics research - NOT helicopter data',
        'Aerospace Engine Prognostics'
    ))
    
    for h5_file in h5_files:
        try:
            file_path = os.path.join(base_path, h5_file)
            dataset_name = h5_file.replace('.h5', '')
            
            logging.info(f"Processing {h5_file}...")
            
            with h5py.File(file_path, 'r') as f:
                # Inspect H5 file structure
                def inspect_structure(name, obj):
                    if isinstance(obj, h5py.Dataset):
                        logging.info(f"  Dataset: {name}, Shape: {obj.shape}, Type: {obj.dtype}")
                
                # f.visititems(inspect_structure)
                
                # Try to extract common C-MAPSS structure
                # Different C-MAPSS datasets may have different structures
                try:
                    # Attempt to read typical C-MAPSS arrays
                    if 'X_s' in f and 'T' in f:
                        # Standard C-MAPSS format
                        X_s = f['X_s'][:]  # Sensor measurements
                        T = f['T'][:]      # Time/cycles
                        
                        if 'Y' in f:
                            Y = f['Y'][:]  # RUL targets
                        else:
                            Y = None
                            
                        # Convert to DataFrame format
                        records = []
                        for i in range(len(T)):
                            record = {
                                'dataset_name': dataset_name,
                                'engine_unit': i + 1,  # Engine unit number
                                'cycle': int(T[i]) if T[i] > 0 else i + 1,
                                'source_id': 'NASA_CMAPSS'
                            }
                            
                            # Add operational conditions (typically first 3 columns)
                            if X_s.ndim >= 2 and X_s.shape[1] >= 3:
                                record['operational_condition_1'] = float(X_s[i, 0]) if i < X_s.shape[0] else None
                                record['operational_condition_2'] = float(X_s[i, 1]) if i < X_s.shape[0] else None  
                                record['operational_condition_3'] = float(X_s[i, 2]) if i < X_s.shape[0] else None
                            
                            # Add sensor measurements (typically 20+ sensors)
                            sensor_start = 3 if X_s.ndim >= 2 else 0
                            for j in range(min(20, X_s.shape[1] - sensor_start)):
                                if i < X_s.shape[0] and sensor_start + j < X_s.shape[1]:
                                    record[f'sensor_{j+1}'] = float(X_s[i, sensor_start + j])
                            
                            # Add RUL if available
                            if Y is not None and i < len(Y):
                                record['rul'] = float(Y[i])
                            
                            records.append(record)
                        
                        # Insert into database in batches
                        if records:
                            df = pd.DataFrame(records)
                            df.to_sql('cmapss_observations', conn, if_exists='append', index=False)
                            total_records += len(records)
                            processed_datasets.append(dataset_name)
                            logging.info(f"  Processed {len(records)} observations from {dataset_name}")
                    
                    else:
                        # Try alternative C-MAPSS structures
                        logging.warning(f"  Unknown H5 structure in {h5_file}, attempting generic extraction...")
                        
                        # Get all datasets in the file
                        datasets = []
                        def collect_datasets(name, obj):
                            if isinstance(obj, h5py.Dataset):
                                datasets.append((name, obj))
                        
                        f.visititems(collect_datasets)
                        
                        if datasets:
                            # Use the largest dataset as main data
                            main_dataset = max(datasets, key=lambda x: x[1].size)
                            data = main_dataset[1][:]
                            
                            if data.ndim == 2:
                                records = []
                                for i in range(data.shape[0]):
                                    record = {
                                        'dataset_name': dataset_name,
                                        'engine_unit': i + 1,
                                        'cycle': i + 1,
                                        'source_id': 'NASA_CMAPSS'
                                    }
                                    
                                    # Map available columns to sensors
                                    for j in range(min(20, data.shape[1])):
                                        if j < 3:
                                            record[f'operational_condition_{j+1}'] = float(data[i, j])
                                        else:
                                            record[f'sensor_{j-2}'] = float(data[i, j])
                                    
                                    records.append(record)
                                
                                if records:
                                    df = pd.DataFrame(records)
                                    df.to_sql('cmapss_observations', conn, if_exists='append', index=False)
                                    total_records += len(records)
                                    processed_datasets.append(dataset_name)
                                    logging.info(f"  Processed {len(records)} observations from {dataset_name} (generic)")
                        
                except Exception as e:
                    logging.error(f"  Error processing {h5_file}: {e}")
                    continue
                    
        except Exception as e:
            logging.error(f"Error reading {h5_file}: {e}")
            continue
    
    conn.commit()
    
    if total_records > 0:
        logging.info(f"Successfully ingested {total_records} C-MAPSS observations from {len(processed_datasets)} datasets")
        return {
            "records": total_records, 
            "columns": 25,  # Estimated columns
            "datasets": processed_datasets,
            "files_processed": len(processed_datasets),
            "total_files": len(h5_files)
        }
    else:
        logging.warning("No C-MAPSS data was successfully processed")
        return {
            "records": 0,
            "columns": 0,
            "datasets": [],
            "files_processed": 0,
            "total_files": len(h5_files),
            "error": "No data extracted from H5 files"
        }

def generate_data_dictionary(conn):
    """Generate comprehensive data dictionary for all datasets"""
    cursor = conn.cursor()
    
    data_dict = {
        "generated_at": datetime.utcnow().isoformat(),
        "datasets": {},
        "tables": {}
    }
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    for table in tables:
        table_name = table[0]
        if table_name.startswith('sqlite_'):
            continue
            
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        # Get record count
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        record_count = cursor.fetchone()[0]
        
        data_dict["tables"][table_name] = {
            "record_count": record_count,
            "columns": {}
        }
        
        for col in columns:
            col_name = col[1]
            col_type = col[2]
            
            # Get sample values and statistics
            try:
                cursor.execute(f"SELECT DISTINCT {col_name} FROM {table_name} LIMIT 5")
                sample_values = [row[0] for row in cursor.fetchall()]
            except:
                sample_values = []
            
            data_dict["tables"][table_name]["columns"][col_name] = {
                "data_type": col_type,
                "sample_values": sample_values
            }
    
    # Save data dictionary
    dict_path = os.path.join(METADATA_DIR, 'data_dictionary.json')
    with open(dict_path, 'w') as f:
        json.dump(data_dict, f, indent=4)
    
    logging.info(f"Generated data dictionary: {dict_path}")

def run_ingestion():
    conn = get_db_connection()
    registry = {
        "last_updated": datetime.utcnow().isoformat(),
        "datasets": {}
    }
    
    # Run ingestion for all datasets
    registry["datasets"]["helicopters"] = ingest_helicopters(conn)
    registry["datasets"]["components"] = ingest_components(conn)
    registry["datasets"]["maintenance"] = ingest_maintenance(conn)
    registry["datasets"]["phm_engine"] = ingest_phm_engine(conn)
    registry["datasets"]["cmapss"] = ingest_cmapss(conn)
    
    # Generate data dictionary
    generate_data_dictionary(conn)
    
    conn.close()
    
    # Save dataset registry
    with open(os.path.join(METADATA_DIR, 'dataset_registry.json'), 'w') as f:
        json.dump(registry, f, indent=4)
        
    logging.info("Dataset ingestion completed successfully.")
    
    # Print summary
    print("\n" + "="*60)
    print("HELIXPERT DATASET INGESTION SUMMARY")
    print("="*60)
    for dataset, info in registry["datasets"].items():
        if info:
            print(f"{dataset.upper():20} | {info.get('records', 0):8,} records")
        else:
            print(f"{dataset.upper():20} | {'NOT LOADED':>8}")
    print("="*60)
    
if __name__ == '__main__':
    run_ingestion()
