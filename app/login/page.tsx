import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.denied}>
        <h1>403</h1>
        <p>Access Denied</p>
      </div>
    </div>
  );
}
